// Appended to the pinned GPS plugin by apply-journal.cjs.
private final class SurveyGuruJournal {
    static let shared = SurveyGuruJournal()
    private let lock = NSLock()
    private var owner: String?
    private var session: String?
    private var lastTime: TimeInterval = 0
    private var failure: Error?
    func configure(owner: String, session: String) {
        lock.lock(); defer { lock.unlock() }
        self.owner = owner; self.session = session; lastTime = 0; failure = nil
    }
    func stop() { lock.lock(); defer { lock.unlock() }; owner = nil; session = nil }
    private func directory() throws -> URL {
        var url = try FileManager.default.url(for: .applicationSupportDirectory, in: .userDomainMask, appropriateFor: nil, create: true).appendingPathComponent("SurveyGuruLocations", isDirectory: true)
        try FileManager.default.createDirectory(at: url, withIntermediateDirectories: true)
        var values = URLResourceValues(); values.isExcludedFromBackup = true; try url.setResourceValues(values)
        return url
    }
    func append(_ location: CLLocation) {
        lock.lock(); defer { lock.unlock() }
        guard let owner = owner, let session = session, location.horizontalAccuracy >= 0, location.horizontalAccuracy <= 100,
              location.timestamp.timeIntervalSince1970 - lastTime >= 10 else { return }
        if #available(iOS 15, *), location.sourceInformation?.isSimulatedBySoftware == true { return }
        do {
            let dir = try directory()
            let files = try FileManager.default.contentsOfDirectory(at: dir, includingPropertiesForKeys: nil)
            if files.count >= 65000 { throw NSError(domain: "SurveyGuru", code: 1, userInfo: [NSLocalizedDescriptionKey: "Location storage is full. Synchronise before continuing."]) }
            let id = UUID().uuidString.lowercased()
            let formatter = ISO8601DateFormatter(); formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
            let point: [String: Any] = ["eventId": id, "ownerId": owner, "sessionId": session, "capturedAt": formatter.string(from: location.timestamp), "latitude": location.coordinate.latitude, "longitude": location.coordinate.longitude, "accuracyMetres": location.horizontalAccuracy, "source": "native_background"]
            let data = try JSONSerialization.data(withJSONObject: point)
            try data.write(to: dir.appendingPathComponent(id + ".json"), options: [.atomic, .completeFileProtectionUntilFirstUserAuthentication])
            lastTime = location.timestamp.timeIntervalSince1970
        } catch { failure = error; self.owner = nil; self.session = nil }
    }
    func pending(owner: String, session: String) throws -> [[String: Any]] {
        lock.lock(); defer { lock.unlock() }
        if let failure = failure { throw failure }
        let files = try FileManager.default.contentsOfDirectory(at: directory(), includingPropertiesForKeys: nil)
        var points: [[String: Any]] = []
        for file in files where file.pathExtension == "json" {
            if let point = try JSONSerialization.jsonObject(with: Data(contentsOf: file)) as? [String: Any], point["ownerId"] as? String == owner, point["sessionId"] as? String == session { points.append(point) }
        }
        return Array(points.sorted { ($0["capturedAt"] as? String ?? "") < ($1["capturedAt"] as? String ?? "") }.prefix(200))
    }
    func acknowledge(owner: String, session: String, eventId: String) throws {
        lock.lock(); defer { lock.unlock() }
        guard UUID(uuidString: eventId) != nil else { throw NSError(domain: "SurveyGuru", code: 2) }
        let file = try directory().appendingPathComponent(eventId.lowercased() + ".json")
        if !FileManager.default.fileExists(atPath: file.path) { return }
        guard let point = try JSONSerialization.jsonObject(with: Data(contentsOf: file)) as? [String: Any], point["ownerId"] as? String == owner, point["sessionId"] as? String == session else { throw NSError(domain: "SurveyGuru", code: 3) }
        try FileManager.default.removeItem(at: file)
    }
}
