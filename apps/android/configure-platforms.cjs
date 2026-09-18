const fs = require('node:fs');
const path = require('node:path');
const android = path.join(__dirname,'android/app/src/main/AndroidManifest.xml');
if(fs.existsSync(android)) {
  let xml = fs.readFileSync(android,'utf8');
  for(const name of ['ACCESS_FINE_LOCATION','ACCESS_COARSE_LOCATION','ACCESS_BACKGROUND_LOCATION','FOREGROUND_SERVICE','FOREGROUND_SERVICE_LOCATION','POST_NOTIFICATIONS']) {
    if(!xml.includes('android.permission.'+name+'"')) xml=xml.replace('</manifest>',`    <uses-permission android:name="android.permission.${name}" />\n</manifest>`);
  }
  fs.writeFileSync(android,xml);
}
const ios = path.join(__dirname,'ios/App/App/Info.plist');
if(fs.existsSync(ios)) {
  let xml=fs.readFileSync(ios,'utf8');
  const values={NSLocationWhenInUseUsageDescription:'Record your movement while searching your assigned project area.',NSLocationAlwaysAndWhenInUseUsageDescription:'Continue recording your assigned search when the screen is locked. Stop tracking from Survey Guru at any time.'};
  for(const [key,value] of Object.entries(values)) if(!xml.includes(`<key>${key}</key>`)) xml=xml.replace(/<\/dict>\s*<\/plist>/,`<key>${key}</key><string>${value}</string>\n</dict></plist>`);
  if(!xml.includes('<key>UIBackgroundModes</key>')) xml=xml.replace(/<\/dict>\s*<\/plist>/,'<key>UIBackgroundModes</key><array><string>location</string></array>\n</dict></plist>');
  else if(!/<key>UIBackgroundModes<\/key>\s*<array>[^]*?<string>location<\/string>/.test(xml)) throw Error('Add location to existing UIBackgroundModes manually; other modes were preserved.');
  fs.writeFileSync(ios,xml);
}
if(!fs.existsSync(android)&&!fs.existsSync(ios)) throw Error('Generate a platform first: npx cap add android (or ios on macOS).');
