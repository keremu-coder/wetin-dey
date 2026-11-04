// Idempotent. Run from the repo root:  node scripts/patch-ios-project.mjs
// Adds to ios/App/App.xcodeproj/project.pbxproj:
//   1. Firebase (FirebaseCore + FirebaseMessaging) via Swift Package Manager
//   2. PrivacyInfo.xcprivacy into the app bundle (it was never in the project)
//   3. GoogleService-Info.plist into the app bundle (written by CI before build)
import { readFileSync, writeFileSync } from "node:fs";

const P = "ios/App/App.xcodeproj/project.pbxproj";
let s = readFileSync(P, "utf8");
const nl = s.includes("\r\n") ? "\r\n" : "\n";
s = s.replace(/\r\n/g, "\n");

function must(cond, msg) { if (!cond) { console.error("patch failed: " + msg); process.exit(1); } }
function insertAfter(marker, text) {
  const i = s.indexOf(marker); must(i >= 0, "marker not found: " + marker.trim());
  const j = i + marker.length; s = s.slice(0, j) + text + s.slice(j);
}
function insertBefore(marker, text) {
  const i = s.indexOf(marker); must(i >= 0, "marker not found: " + marker.trim());
  s = s.slice(0, i) + text + s.slice(i);
}

const ID = {
  privFile: "9A1B2C3D4E5F60718293A4B1", privBuild: "9A1B2C3D4E5F60718293A4B2",
  gsFile:   "9A1B2C3D4E5F60718293A4B3", gsBuild:   "9A1B2C3D4E5F60718293A4B4",
  fbRepo:   "9A1B2C3D4E5F60718293A4C1",
  coreDep:  "9A1B2C3D4E5F60718293A4C2", msgDep:   "9A1B2C3D4E5F60718293A4C3",
  coreBld:  "9A1B2C3D4E5F60718293A4C4", msgBld:   "9A1B2C3D4E5F60718293A4C5"
};

if (!s.includes("PrivacyInfo.xcprivacy")) {
  insertAfter("/* Begin PBXBuildFile section */\n",
    `\t\t${ID.privBuild} /* PrivacyInfo.xcprivacy in Resources */ = {isa = PBXBuildFile; fileRef = ${ID.privFile} /* PrivacyInfo.xcprivacy */; };\n` +
    `\t\t${ID.gsBuild} /* GoogleService-Info.plist in Resources */ = {isa = PBXBuildFile; fileRef = ${ID.gsFile} /* GoogleService-Info.plist */; };\n`);
  insertAfter("/* Begin PBXFileReference section */\n",
    `\t\t${ID.privFile} /* PrivacyInfo.xcprivacy */ = {isa = PBXFileReference; lastKnownFileType = text.xml; path = PrivacyInfo.xcprivacy; sourceTree = "<group>"; };\n` +
    `\t\t${ID.gsFile} /* GoogleService-Info.plist */ = {isa = PBXFileReference; lastKnownFileType = text.plist.xml; path = "GoogleService-Info.plist"; sourceTree = "<group>"; };\n`);
  insertAfter("\t\t\t\t50B271D01FEDC1A000F3C39B /* public */,\n",
    `\t\t\t\t${ID.privFile} /* PrivacyInfo.xcprivacy */,\n\t\t\t\t${ID.gsFile} /* GoogleService-Info.plist */,\n`);
  insertAfter("\t\t\t\t2FAD9763203C412B000D30F8 /* config.xml in Resources */,\n",
    `\t\t\t\t${ID.privBuild} /* PrivacyInfo.xcprivacy in Resources */,\n\t\t\t\t${ID.gsBuild} /* GoogleService-Info.plist in Resources */,\n`);
  console.log("added privacy manifest + GoogleService-Info.plist");
} else console.log("privacy manifest already in project");

if (!s.includes("firebase-ios-sdk")) {
  insertAfter("/* Begin PBXBuildFile section */\n",
    `\t\t${ID.coreBld} /* FirebaseCore in Frameworks */ = {isa = PBXBuildFile; productRef = ${ID.coreDep} /* FirebaseCore */; };\n` +
    `\t\t${ID.msgBld} /* FirebaseMessaging in Frameworks */ = {isa = PBXBuildFile; productRef = ${ID.msgDep} /* FirebaseMessaging */; };\n`);
  insertAfter("\t\t\t\t4D22ABE92AF431CB00220026 /* CapApp-SPM in Frameworks */,\n",
    `\t\t\t\t${ID.coreBld} /* FirebaseCore in Frameworks */,\n\t\t\t\t${ID.msgBld} /* FirebaseMessaging in Frameworks */,\n`);
  insertAfter("\t\t\t\t4D22ABE82AF431CB00220026 /* CapApp-SPM */,\n",
    `\t\t\t\t${ID.coreDep} /* FirebaseCore */,\n\t\t\t\t${ID.msgDep} /* FirebaseMessaging */,\n`);
  insertAfter("\t\t\t\tD4C12C0A2AAA248700AAC8A2 /* XCLocalSwiftPackageReference \"CapApp-SPM\" */,\n",
    `\t\t\t\t${ID.fbRepo} /* XCRemoteSwiftPackageReference "firebase-ios-sdk" */,\n`);
  insertBefore("/* Begin XCSwiftPackageProductDependency section */\n",
    `/* Begin XCRemoteSwiftPackageReference section */\n` +
    `\t\t${ID.fbRepo} /* XCRemoteSwiftPackageReference "firebase-ios-sdk" */ = {\n` +
    `\t\t\tisa = XCRemoteSwiftPackageReference;\n` +
    `\t\t\trepositoryURL = "https://github.com/firebase/firebase-ios-sdk";\n` +
    `\t\t\trequirement = {\n\t\t\t\tkind = upToNextMajorVersion;\n\t\t\t\tminimumVersion = 11.0.0;\n\t\t\t};\n` +
    `\t\t};\n/* End XCRemoteSwiftPackageReference section */\n\n`);
  insertBefore("/* End XCSwiftPackageProductDependency section */",
    `\t\t${ID.coreDep} /* FirebaseCore */ = {\n\t\t\tisa = XCSwiftPackageProductDependency;\n\t\t\tpackage = ${ID.fbRepo} /* XCRemoteSwiftPackageReference "firebase-ios-sdk" */;\n\t\t\tproductName = FirebaseCore;\n\t\t};\n` +
    `\t\t${ID.msgDep} /* FirebaseMessaging */ = {\n\t\t\tisa = XCSwiftPackageProductDependency;\n\t\t\tpackage = ${ID.fbRepo} /* XCRemoteSwiftPackageReference "firebase-ios-sdk" */;\n\t\t\tproductName = FirebaseMessaging;\n\t\t};\n`);
  console.log("added Firebase SPM dependency");
} else console.log("Firebase already in project");

for (const [o, c] of [["{", "}"], ["(", ")"]]) {
  must(s.split(o).length === s.split(c).length, `unbalanced ${o}${c}`);
}
writeFileSync(P, s.replace(/\n/g, nl));