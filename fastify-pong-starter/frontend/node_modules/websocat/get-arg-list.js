module.exports = (config) => {
  const args = []

  if (config.exitOnEOF) args.push("-E")
  if (config.binary) args.push("-b")
  if (config.text) args.push("-t")
  if (config.noClose) args.push("-n")
  if (config.insecure) args.push("-k")
  if (config.unidirectional) args.push("-u")
  if (config.unidirectionalReverse) args.push("-U")
  if (config.onshot) args.push("--oneshot")
  if (config.oneMessage) args.push("-1")
  if (config.nullTerminated) args.push("-0")

  if (config.headers) {
    args.push(
      ...Object.entries(config.headers).flatMap(([k, v]) => [
        "-H",
        `"${k}: ${v}"`,
      ])
    )
  }

  if (config.serverHeaders) {
    args.push(
      ...Object.entries(config.serverHeaders).flatMap(([k, v]) => [
        "--server-header",
        `${k}: ${v}`,
      ])
    )
  }

  if (config.verbose) args.push("-v")

  args.push(config.addr1 || config.listen)
  args.push(config.addr2 || config.host)

  // TODO many more args

  return args
}
