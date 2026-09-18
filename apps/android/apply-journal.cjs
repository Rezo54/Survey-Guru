// Deterministic, version-pinned native extension. No upstream files are downloaded here.
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'../../node_modules/@capgo/background-geolocation');
if(JSON.parse(fs.readFileSync(path.join(root,'package.json'),'utf8')).version!=='8.4.6')throw Error('Review the native journal patch before upgrading the GPS plugin.');
function patch(relative,edit){const file=path.join(root,relative);let text=fs.readFileSync(file,'utf8');if(text.includes('// SurveyGuru native journal v1')){
  if(relative.endsWith('.swift')) { const index=text.indexOf('// Appended to the pinned GPS plugin'); if(index<0)throw Error('Native journal helper missing.'); fs.writeFileSync(file,text.slice(0,index)+fs.readFileSync(path.join(__dirname,'journal/SurveyGuruJournal.swift'),'utf8')+'\n// SurveyGuru native journal v1\n'); }
  return;
}text=edit(text);fs.writeFileSync(file,text+'\n// SurveyGuru native journal v1\n');}
function replace(text,find,value){if(text.split(find).length!==2)throw Error('Native source changed: '+find.slice(0,60));return text.replace(find,value);}
const android='android/src/main/java/com/capgo/capacitor_background_geolocation/';
fs.copyFileSync(path.join(__dirname,'journal/SurveyGuruJournal.java'),path.join(root,android,'SurveyGuruJournal.java'));
patch(android+'BackgroundGeolocationService.java',s=>replace(s,'        startWatchdog();\n        if (nativePostUrl != null)', '        SurveyGuruJournal.append(this, location);\n        startWatchdog();\n        if (nativePostUrl != null)'));
patch(android+'BackgroundGeolocation.java',s=>{
 s=replace(s,'    public void stop(PluginCall call) {','    public void stop(PluginCall call) {\n        SurveyGuruJournal.stop();');
 return replace(s,'public class BackgroundGeolocation extends Plugin {',`public class BackgroundGeolocation extends Plugin {
    @PluginMethod public void configureJournal(PluginCall call) {
        String owner = call.getString("ownerId"), session = call.getString("sessionId");
        if (owner == null || owner.isEmpty() || session == null || session.isEmpty()) { call.reject("Account and session are required."); return; }
        SurveyGuruJournal.configure(owner, session); call.resolve();
    }
    @PluginMethod public void pendingJournal(PluginCall call) {
        try { JSObject result = new JSObject(); result.put("points", SurveyGuruJournal.pending(getContext(), call.getString("ownerId", ""), call.getString("sessionId", ""))); call.resolve(result); }
        catch (Exception error) { call.reject(error.getMessage()); }
    }
    @PluginMethod public void acknowledgeJournal(PluginCall call) {
        try { SurveyGuruJournal.acknowledge(getContext(), call.getString("ownerId", ""), call.getString("sessionId", ""), call.getString("eventId")); call.resolve(); }
        catch (Exception error) { call.reject(error.getMessage()); }
    }
`);
});
patch('ios/Sources/CapgoBackgroundGeolocationPlugin/CapgoCapacitorBackgroundGeolocationPlugin.swift',s=>{
 s=replace(s,'        CAPPluginMethod(name: "start", returnType: CAPPluginReturnCallback),',`        CAPPluginMethod(name: "configureJournal", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "pendingJournal", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "acknowledgeJournal", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "start", returnType: CAPPluginReturnCallback),`);
 s=replace(s,'    @objc func stop(_ call: CAPPluginCall) {','    @objc func stop(_ call: CAPPluginCall) {\n        SurveyGuruJournal.shared.stop()');
 s=replace(s,'        postLocation(location)','        for point in locations where isLocationValid(point) { SurveyGuruJournal.shared.append(point) }\n        postLocation(location)');
 s=replace(s,'    @objc func start(_ call: CAPPluginCall) {',`    @objc func configureJournal(_ call: CAPPluginCall) {
        guard let owner = call.getString("ownerId"), !owner.isEmpty, let session = call.getString("sessionId"), !session.isEmpty else { call.reject("Account and session are required."); return }
        SurveyGuruJournal.shared.configure(owner: owner, session: session); call.resolve()
    }
    @objc func pendingJournal(_ call: CAPPluginCall) {
        do { call.resolve(["points": try SurveyGuruJournal.shared.pending(owner: call.getString("ownerId") ?? "", session: call.getString("sessionId") ?? "")]) }
        catch { call.reject(error.localizedDescription) }
    }
    @objc func acknowledgeJournal(_ call: CAPPluginCall) {
        do { try SurveyGuruJournal.shared.acknowledge(owner: call.getString("ownerId") ?? "", session: call.getString("sessionId") ?? "", eventId: call.getString("eventId") ?? ""); call.resolve() }
        catch { call.reject(error.localizedDescription) }
    }
    @objc func start(_ call: CAPPluginCall) {`);
 return s+'\n'+fs.readFileSync(path.join(__dirname,'journal/SurveyGuruJournal.swift'),'utf8');
});
console.log('Native GPS journal applied for Android and iOS (plugin 8.4.6).');
