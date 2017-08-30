var MainSale = artifacts.require("./MainSale.sol");

module.exports = function(deployer) {
  deployer.deploy(MainSale, [], {gas: 3000000});
};
