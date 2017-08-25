var MainSale = artifacts.require("./MainSale.sol");

module.exports = function(deployer) {
  deployer.deploy(MainSale, [], {gas: 2300000});
};
