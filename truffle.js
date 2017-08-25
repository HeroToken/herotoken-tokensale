module.exports = {
  networks: {
    development: {
      host: "localhost",
      port: 8545,
      network_id: "*", // Match any network id
      gas: 100000,
      gasPrice: 25000000000
    }
  }
};
