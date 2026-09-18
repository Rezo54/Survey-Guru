package com.capgo.capacitor_background_geolocation;

import android.content.Context;
import android.location.Location;
import androidx.core.location.LocationCompat;
import org.json.JSONArray;
import org.json.JSONObject;
import java.io.File;
import java.io.FileOutputStream;
import java.nio.charset.StandardCharsets;
import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.io.FileInputStream;
import java.text.SimpleDateFormat;
import java.util.Arrays;
import java.util.Date;
import java.util.Locale;
import java.util.TimeZone;
import java.util.UUID;

/** Private native disk journal: write before emitting a WebView callback, delete only after server acknowledgement. */
final class SurveyGuruJournal {
    private static String owner;
    private static String session;
    private static String failure;
    private static long lastTime;
    static synchronized void configure(String nextOwner, String nextSession) {
        owner = nextOwner; session = nextSession; lastTime = 0; failure = null;
    }
    static synchronized void stop() { owner = null; session = null; }
    private static File directory(Context context) throws Exception {
        File dir = new File(context.getNoBackupFilesDir(), "survey-guru-locations");
        if (!dir.exists() && !dir.mkdirs()) throw new Exception("Cannot create location storage.");
        return dir;
    }
    private static String read(File file) throws Exception {
        StringBuilder value = new StringBuilder();
        try (BufferedReader reader = new BufferedReader(new InputStreamReader(new FileInputStream(file), StandardCharsets.UTF_8))) {
            String line; while ((line = reader.readLine()) != null) value.append(line);
        }
        return value.toString();
    }
    static synchronized void append(Context context, Location location) {
        if (owner == null || session == null || LocationCompat.isMock(location) || location.getTime() <= lastTime || location.getTime() - lastTime < 10000 || !location.hasAccuracy() || location.getAccuracy() < 0 || location.getAccuracy() > 100) return;
        try {
            File dir = directory(context);
            String[] names = dir.list();
            if (names != null && names.length >= 65000) throw new Exception("Location storage is full. Synchronise before continuing.");
            String id = UUID.randomUUID().toString();
            SimpleDateFormat date = new SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.US); date.setTimeZone(TimeZone.getTimeZone("UTC"));
            JSONObject point = new JSONObject().put("eventId", id).put("ownerId", owner).put("sessionId", session)
                .put("capturedAt", date.format(new Date(location.getTime()))).put("latitude", location.getLatitude()).put("longitude", location.getLongitude())
                .put("accuracyMetres", location.getAccuracy()).put("source", "native_background");
            File temp = new File(dir, id + ".tmp");
            try (FileOutputStream output = new FileOutputStream(temp)) { output.write(point.toString().getBytes(StandardCharsets.UTF_8)); output.getFD().sync(); }
            if (!temp.renameTo(new File(dir, id + ".json"))) throw new Exception("Could not commit location to disk.");
            lastTime = location.getTime();
        } catch (Exception error) { failure = error.getMessage(); owner = null; session = null; }
    }
    static synchronized JSONArray pending(Context context, String userId, String sessionId) throws Exception {
        if (failure != null) throw new Exception(failure);
        File[] files = directory(context).listFiles((dir, name) -> name.endsWith(".json"));
        JSONArray result = new JSONArray();
        if (files == null) return result;
        Arrays.sort(files, (a,b) -> Long.compare(a.lastModified(), b.lastModified()));
        for (File file : files) {
            JSONObject point = new JSONObject(read(file));
            if (userId.equals(point.optString("ownerId")) && sessionId.equals(point.optString("sessionId"))) { result.put(point); if (result.length() >= 200) break; }
        }
        return result;
    }
    static synchronized void acknowledge(Context context, String userId, String sessionId, String eventId) throws Exception {
        if (eventId == null || !eventId.matches("[a-f0-9-]{36}")) throw new Exception("Invalid event ID.");
        File file = new File(directory(context), eventId + ".json");
        if (!file.exists()) return;
        JSONObject point = new JSONObject(read(file));
        if (!userId.equals(point.optString("ownerId")) || !sessionId.equals(point.optString("sessionId"))) throw new Exception("Location belongs to another account or session.");
        if (!file.delete()) throw new Exception("Could not acknowledge saved location.");
    }
}
