const bent = require("bent")
const os = require("os")
const downloadFile = require("./download-file")
const path = require("path")
const fs = require("fs")

const getJSON = bent("json", {
  "User-Agent": "seveibar, node-websocat (an npm module)",
})

const platform = os.platform()
const arch = os.arch()
let osRelease = null

switch (platform) {
  case "win32":
    osRelease = `win32.exe`
    break
  case "win64":
    osRelease = `win64.exe`
    break
  case "darwin":
    osRelease = "mac"
    break
  case "freebsd":
    osRelease = "freebsd"
    break
  case "linux":
    osRelease = `${arch.replace("x64", "amd64")}-linux-static`
    break
  // case 'aix': console.log("IBM AIX platform");
  //   break;
  // case 'android': console.log("Android platform");
  //   break;
  // case 'openbsd': console.log("OpenBSD platform");
  //   break;
  // case 'sunos': console.log("SunOS platform");
  //   break;

  default:
    osRelease = `${arch}-${platform}`
}

// Originally derived from the package.json, but that approach doesn't allow for
// any patches to the bindings... Maybe only sync major versions in the future?
// Either that or tag the releases for older version e.g. 1.2.3-websocat
const releaseVersionToUse = "1.8.0"

module.exports = async () => {
  // Get all the assets from the github release page
  const releaseAPIUrl = `https://api.github.com/repos/vi/websocat/releases/tags/v${releaseVersionToUse}`
  const githubReleasesJSONPath = path.resolve(__dirname, "github_releases.json")
  let githubReleasesJSON
  if (!fs.existsSync(githubReleasesJSONPath)) {
    githubReleasesJSON = await getJSON(releaseAPIUrl)
    fs.writeFileSync(githubReleasesJSONPath, JSON.stringify(githubReleasesJSON))
  } else {
    githubReleasesJSON = JSON.parse(
      fs.readFileSync(githubReleasesJSONPath).toString()
    )
  }
  const { assets } = githubReleasesJSON

  // Find the asset for my operating system
  const myAsset = assets.find((asset) => asset.name.includes(osRelease))

  if (!myAsset) {
    throw new Error(
      `Couldn't find websocat version compatible with ${osRelease},\n\nAvailable releases:\n${assets
        .map((a) => `\t* ${a.name}`)
        .join("\n")}`
    )
  }

  // Download the asset (which is a compressed version of the executable)
  // e.g. download something like websocat-ubuntu.tar.xz

  const downloadPath = path.resolve(__dirname, myAsset.name)

  if (!fs.existsSync(path.join(__dirname, myAsset.name))) {
    console.log(`Downloading ${myAsset.name}...`)

    await downloadFile(myAsset.browser_download_url, downloadPath)

    fs.chmodSync(downloadPath, 0o755)
  }

  return path.resolve(__dirname, downloadPath)
}

if (!module.parent) {
  module.exports().then(() => {})
}
