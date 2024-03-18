module.exports = {
  mongodbMemoryServerOptions: {
    binary: {
      skipMD5: true,
    },
    autoStart: false,
    instance: {},
    replSet: {},
  },
  useSharedDBForAllJestWorkers: true,
}
