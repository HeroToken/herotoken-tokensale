var BigInteger = require('big-integer');

var MainSale = artifacts.require("./MainSale.sol");
var HeroToken = artifacts.require("./HeroToken.sol");


var gwei = 1e9;
var ether = 1e18;
var units = 1e18;

var hours_ago = function(hours) {
  // current date's milliseconds - 1,000 ms * 60 s * 60 mins * (# of days beyond one to go back)
  today = new Date();
  var desired = today - 1000 * 60 * 60 *  hours;
  return (new Date(desired)).getTime() / 1000;
};

var days_ago = function(days) {
  // current date's milliseconds - 1,000 ms * 60 s * 60 mins * 24 hrs * (# of days beyond one to go back)
  today = new Date();
  var desired = today - 1000 * 60 * 60 * 24 * days;
  return (new Date(desired)).getTime() / 1000;
};

var getEthers = function(address) {
  return new Promise(function(resolve, reject) {
    web3.eth.getBalance(address, function(error, result) {
      if (error) {
        reject(error);
      } else {
        resolve(result);
      }
    });
  });
};

contract('MainSale', function(accounts, others) {
  var sale;
  var token;
  var owner;
  beforeEach(function() {
    return MainSale.new({gas: 2500000}).then(function(_sale) {
      sale = _sale;
      return sale.owner();
    }).then(function(_owner) {
      owner = _owner;
      return sale.token();
    }).then(function(_token_address) {
      return HeroToken.at(_token_address);
    }).then(function(_token) {
      token = _token;
      return true;
    });
  });

  // Start Date
  describe('start date', function() {
    var august1 = new Date("August 1, 2017 00:00:00 +0").getTime() / 1000;
    var december31 = new Date("December 31, 2020 00:00:00 +0").getTime() / 1000;


    it("should allow updating the date of the sale", function() {
      return sale.setStart(august1).then(function() {
        return sale.start();
      }).then(function(_newStart) {
        assert.equal(_newStart.valueOf(), august1, "Date updated correctly");
      });
    });

    it("should not allow others to update the date of the sale", function() {
      return sale.setStart(august1, {from: accounts[2]}).catch(function(_error) {
        return sale.start();
      }).then(function(_newStart) {
        assert.equal(_newStart.valueOf(), december31, "Date not updated");
      });
    });
  });

  // Token purchase
  describe("buying tokens", function() {
    beforeEach(function() {
      return Promise.all([
        sale.setStart(days_ago(15)),
      ]);
    });

    it("should allow me to buy tokens during the sale by paying the contract", function() {
      var initialTokens;
      var initialEthers;
      var finalTokens;
      var finalEthers;
      var buyer = accounts[0];
      return sale.setStart(days_ago(15)).then(function() {
        return Promise.all([
          getEthers(buyer),
          token.balanceOf(buyer),
        ]);
      }).then(function(_result) {
        initialEthers = _result[0];
        initialTokens = _result[1];
        return sale.sendTransaction({from: buyer, value: 1 * ether});
      }).then(function(transaction) {
        return Promise.all([
          getEthers(buyer),
          token.balanceOf(buyer),
        ]);
      }).then(function(_result) {
        finalEthers = _result[0];
        finalTokens = _result[1];

        assert.isAbove(finalTokens.valueOf(), initialTokens.valueOf(), "Purchased token");
        assert.isAbove(initialEthers.valueOf() - finalEthers.valueOf(), 1 * ether, "Spent a lot of ethers");
        assert.isBelow(initialEthers.valueOf() - finalEthers.valueOf(), 1.01 * ether, "Did not spent too much ethers");
      });
    });

    it("should allow me to buy tokens during the sale by calling the createTokens function", function() {
      var initialTokens;
      var initialEthers;
      var finalTokens;
      var finalEthers;
      var buyer = accounts[0];
      return sale.setStart(days_ago(15)).then(function() {
        return Promise.all([
          getEthers(buyer),
          token.balanceOf(buyer),
        ]);
      }).then(function(_result) {
        initialEthers = _result[0];
        initialTokens = _result[1];
        return sale.createTokens(buyer, {from: buyer, value: 1 * ether});
      }).then(function(transaction) {
        return Promise.all([
          getEthers(buyer),
          token.balanceOf(buyer),
        ]);
      }).then(function(_result) {
        finalEthers = _result[0];
        finalTokens = _result[1];

        assert.isAbove(finalTokens.valueOf(), initialTokens.valueOf(), "Purchased token");
        assert.isAbove(initialEthers.valueOf() - finalEthers.valueOf(), 1 * ether, "Spent a lot of ethers");
        assert.isBelow(initialEthers.valueOf() - finalEthers.valueOf(), 1.01 * ether, "Did not spent too much ethers");
      });
    });

    it("should allow me to buy tokens for someone else", function() {
      var buyer = accounts[0];
      var recipient = accounts[1];
      var initialTokens;
      var initialEthers;
      var initialTokensRecipient;
      var initialEthersRecipient;
      var finalTokens;
      var finalEthers;
      var finalTokensRecipient;
      var finalEthersRecipient;
      return sale.setStart(days_ago(15)).then(function() {
        return Promise.all([
          getEthers(buyer),
          token.balanceOf.call(buyer),
          getEthers(recipient),
          token.balanceOf.call(recipient),
        ]);
      }).then(function(_result) {
        initialEthers = _result[0];
        initialTokens = _result[1];
        initialEthersRecipient = _result[2];
        initialTokensRecipient = _result[3];
        return sale.createTokens(recipient, {from: buyer, value: 1 * ether});
      }).then(function(transaction) {
        return Promise.all([
          getEthers(buyer),
          token.balanceOf.call(buyer),
          getEthers(recipient),
          token.balanceOf.call(recipient),
        ]);
      }).then(function(_result) {
        finalEthers = _result[0];
        finalTokens = _result[1];
        finalEthersRecipient = _result[2];
        finalTokensRecipient = _result[3];

        assert.equal(finalTokens.valueOf(), initialTokens.valueOf(), "Buyer tokens unchanged");
        assert.isAbove(initialEthers.valueOf() - finalEthers.valueOf(), 1 * ether, "Spent a lot of ethers");
        assert.isBelow(initialEthers.valueOf() - finalEthers.valueOf(), 1.01 * ether, "Did not spent too much ethers");
        assert.isAbove(finalTokensRecipient.valueOf(), initialTokensRecipient.valueOf(), "Recipient tokens increased");
        assert.equal(initialEthersRecipient.valueOf(), finalEthersRecipient.valueOf(), "Recipient did not spend ethers");
      });
    });

    it("should not allow me to buy tokens after the sale by paying the contract", function() {
      var initialTokens;
      var initialEthers;
      var finalTokens;
      var finalEthers;
      var buyer = accounts[0];
      return sale.finishMinting().then(function() {
        return Promise.all([
          getEthers(buyer),
          token.balanceOf(buyer),
        ]);
      }).then(function(_result) {
        initialEthers = _result[0];
        initialTokens = _result[1];
        return sale.sendTransaction({from: buyer, value: 1 * ether});
      }).catch(function(error) {
        return Promise.all([
          getEthers(buyer),
          token.balanceOf(buyer),
        ]);
      }).then(function(_result) {
        finalEthers = _result[0];
        finalTokens = _result[1];

        assert.equal(finalTokens.valueOf(), initialTokens.valueOf(), "Tokens unchanged");
        assert.isBelow(initialEthers.valueOf() - finalEthers.valueOf(), 0.01 * ether, "Did not spend much ether");
      });
    });

    it("should not allow me to buy tokens after the sale by paying the contract", function() {
      var initialTokens;
      var initialEthers;
      var finalTokens;
      var finalEthers;
      var buyer = accounts[0];
      return sale.setSaleOngoing(false).then(function() {
        return Promise.all([
          getEthers(buyer),
          token.balanceOf(buyer),
        ]);
      }).then(function(_result) {
        initialEthers = _result[0];
        initialTokens = _result[1];
        return sale.sendTransaction({from: buyer, value: 1 * ether});
      }).catch(function(error) {
        return Promise.all([
          getEthers(buyer),
          token.balanceOf(buyer),
        ]);
      }).then(function(_result) {
        finalEthers = _result[0];
        finalTokens = _result[1];

        assert.equal(finalTokens.valueOf(), initialTokens.valueOf(), "Tokens unchanged");
        assert.isBelow(initialEthers.valueOf() - finalEthers.valueOf(), 0.01 * ether, "Did not spend much ether");
      });
    });

    it("should not allow me to buy tokens after the sale by calling the createTokens function", function() {
      var initialTokens;
      var initialEthers;
      var finalTokens;
      var finalEthers;
      var buyer = accounts[0];
      return sale.finishMinting().then(function() {
        return Promise.all([
          getEthers(buyer),
          token.balanceOf(buyer),
        ]);
      }).then(function(_result) {
        initialEthers = _result[0];
        initialTokens = _result[1];
        return sale.createTokens(buyer, {from: buyer, value: 1 * ether});
      }).catch(function(error) {
        return Promise.all([
          getEthers(buyer),
          token.balanceOf(buyer),
        ]);
      }).then(function(_result) {
        finalEthers = _result[0];
        finalTokens = _result[1];

        assert.equal(finalTokens.valueOf(), initialTokens.valueOf(), "Tokens unchanged");
        assert.isBelow(initialEthers.valueOf() - finalEthers.valueOf(), 0.01 * ether, "Did not spend much ether");
      });

    });
  });

  // Exchange Rate
  describe('token price', function() {
    beforeEach(function() {
      return Promise.all([
        sale.setStart(days_ago(15)),
      ]);
    });

    it("should allow updating the exchange rate", function() {
      var oldExchangeRate;
      return sale.exchangeRate().then(function(_exchangeRate) {
        oldExchangeRate = _exchangeRate;
        return sale.setExchangeRate(500);
      }).then(function() {
        return sale.exchangeRate();
      }).then(function(_newExchangeRate) {
        assert.equal(oldExchangeRate.valueOf(), 200, "Original exchange rate is correct");
        assert.equal(_newExchangeRate.valueOf(), 500, "Replaced exchange rate is correct");
      });
    });

    it("should not allow others to update the exchange rate", function() {
      var oldExchangeRate;
      return sale.exchangeRate().then(function(_exchangeRate) {
        oldExchangeRate = _exchangeRate;
        return sale.setExchangeRate(500, {from: accounts[3]});
      }).catch(function(error) {
        return sale.exchangeRate();
      }).then(function(_newExchangeRate) {
        assert.equal(_newExchangeRate.valueOf(), oldExchangeRate.valueOf(), "Exchange rate does not update");
      });
    });


    it("should allow me to purchase coins at the correct rate", function() {
      var initialEthers;
      var initialTokens;
      var finalEthers;
      var finalTokens;
      var buyer = accounts[0];
      Promise.all([
        getEthers(buyer),
        token.balanceOf(buyer),
      ]).then(function(_result) {
        initialEthers = _result[0];
        initialTokens = _result[1];
        return sale.sendTransaction({from: buyer, value: 1 * ether});
      }).then(function(transaction) {
        return Promise.all([
          getEthers(buyer),
          token.balanceOf(buyer),
        ]);
      }).then(function(_result) {
        finalEthers = _result[0];
        finalTokens = _result[1];

        assert.equal(finalTokens.valueOf() - initialTokens.valueOf(), 200 * units, "Purchased tokens is correct");
      });
    });

    it("should allow buying at the updated exchange rate", function() {
      var initialEthers;
      var initialTokens;
      var finalEthers;
      var finalTokens;
      var buyer = accounts[0];
      return sale.setExchangeRate(500).then(function() {
        return Promise.all([
          getEthers(buyer),
          token.balanceOf(buyer),
        ]);
      }).then(function(_result) {
        initialEthers = _result[0];
        initialTokens = _result[1];
        return sale.sendTransaction({from: buyer, value: 0.003 * ether});
      }).then(function(transaction) {
        return Promise.all([
          getEthers(buyer),
          token.balanceOf(buyer),
        ]);
      }).then(function(_result) {
        finalEthers = _result[0];
        finalTokens = _result[1];

        assert.equal(finalTokens.valueOf() - initialTokens.valueOf(), 1.5 * units, "Purchased tokens is correct");
      });
    });
  });

  // Bonus tokens
  describe('token bonuses', function() {
    beforeEach(function() {
      return Promise.all([
        sale.setStart(days_ago(15)),
      ]);
    });

    it("should give 30% bonus tokens during the first three hours", function() {
      var initialTokens;
      var initialEthers;
      var finalTokens;
      var finalEthers;
      var buyer = accounts[0];
      return sale.setStart(hours_ago(2.9)).then(function() {
        return Promise.all([
          getEthers(buyer),
          token.balanceOf(buyer),
        ]);
      }).then(function(_result) {
        initialEthers = _result[0];
        initialTokens = _result[1];
        return sale.sendTransaction({from: buyer, value: 1 * ether});
      }).then(function(transaction) {
        return Promise.all([
          getEthers(buyer),
          token.balanceOf(buyer),
        ]);
      }).then(function(_result) {
        finalEthers = _result[0];
        finalTokens = _result[1];
        initialParsed = BigInteger(initialTokens.toString());
        finalParsed = BigInteger(finalTokens.toString());
        assert(finalParsed.minus(initialParsed).equals(BigInteger("260000000000000000000")), "Purchased tokens is correct");
      });
    });

    it("should give 20% bonus tokens during the first twenty four hours", function() {
      var initialTokens;
      var initialEthers;
      var finalTokens;
      var finalEthers;
      var buyer = accounts[0];
      return sale.setStart(hours_ago(23.9)).then(function() {
        return Promise.all([
          getEthers(buyer),
          token.balanceOf(buyer),
        ]);
      }).then(function(_result) {
        initialEthers = _result[0];
        initialTokens = _result[1];
        return sale.sendTransaction({from: buyer, value: 1 * ether});
      }).then(function(transaction) {
        return Promise.all([
          getEthers(buyer),
          token.balanceOf(buyer),
        ]);
      }).then(function(_result) {
        finalEthers = _result[0];
        finalTokens = _result[1];
        initialParsed = BigInteger(initialTokens.toString());
        finalParsed = BigInteger(finalTokens.toString());
        assert(finalParsed.minus(initialParsed).equals(BigInteger("240000000000000000000")), "Purchased tokens is correct");
      });
    });

    it("should give 10% bonus tokens during the first three days", function() {
      var initialTokens;
      var initialEthers;
      var finalTokens;
      var finalEthers;
      var buyer = accounts[0];
      return sale.setStart(hours_ago(71.9)).then(function() {
        return Promise.all([
          getEthers(buyer),
          token.balanceOf(buyer),
        ]);
      }).then(function(_result) {
        initialEthers = _result[0];
        initialTokens = _result[1];
        return sale.sendTransaction({from: buyer, value: 1 * ether});
      }).then(function(transaction) {
        return Promise.all([
          getEthers(buyer),
          token.balanceOf(buyer),
        ]);
      }).then(function(_result) {
        finalEthers = _result[0];
        finalTokens = _result[1];
        initialParsed = BigInteger(initialTokens.toString());
        finalParsed = BigInteger(finalTokens.toString());
        assert(finalParsed.minus(initialParsed).equals(BigInteger("220000000000000000000")), "Purchased tokens is correct");
      });
    });

    it("should give 5% bonus tokens during the first seven days", function() {
      var initialTokens;
      var initialEthers;
      var finalTokens;
      var finalEthers;
      var buyer = accounts[0];
      return sale.setStart(hours_ago(167.9)).then(function() {
        return Promise.all([
          getEthers(buyer),
          token.balanceOf(buyer),
        ]);
      }).then(function(_result) {
        initialEthers = _result[0];
        initialTokens = _result[1];
        return sale.sendTransaction({from: buyer, value: 1 * ether});
      }).then(function(transaction) {
        return Promise.all([
          getEthers(buyer),
          token.balanceOf(buyer),
        ]);
      }).then(function(_result) {
        finalEthers = _result[0];
        finalTokens = _result[1];
        initialParsed = BigInteger(initialTokens.toString());
        finalParsed = BigInteger(finalTokens.toString());
        assert(finalParsed.minus(initialParsed).equals(BigInteger("210000000000000000000")), "Purchased tokens is correct");
      });
    });

    it("should give 2.5% bonus tokens during the first fourteen days", function() {
      var initialTokens;
      var initialEthers;
      var finalTokens;
      var finalEthers;
      var buyer = accounts[0];
      return sale.setStart(hours_ago(335.9)).then(function() {
        return Promise.all([
          getEthers(buyer),
          token.balanceOf(buyer),
        ]);
      }).then(function(_result) {
        initialEthers = _result[0];
        initialTokens = _result[1];
        return sale.sendTransaction({from: buyer, value: 1 * ether});
      }).then(function(transaction) {
        return Promise.all([
          getEthers(buyer),
          token.balanceOf(buyer),
        ]);
      }).then(function(_result) {
        finalEthers = _result[0];
        finalTokens = _result[1];
        initialParsed = BigInteger(initialTokens.toString());
        finalParsed = BigInteger(finalTokens.toString());
        assert(finalParsed.minus(initialParsed).equals(BigInteger("205000000000000000000")), "Purchased tokens is correct");
      });
    });

    it("should give no bonus tokens after day 14", function() {
      var initialTokens;
      var initialEthers;
      var finalTokens;
      var finalEthers;
      var buyer = accounts[0];
      return sale.setStart(hours_ago(336.1)).then(function() {
        return Promise.all([
          getEthers(buyer),
          token.balanceOf(buyer),
        ]);
      }).then(function(_result) {
        initialEthers = _result[0];
        initialTokens = _result[1];
        return sale.sendTransaction({from: buyer, value: 1 * ether});
      }).then(function(transaction) {
        return Promise.all([
          getEthers(buyer),
          token.balanceOf(buyer),
        ]);
      }).then(function(_result) {
        finalEthers = _result[0];
        finalTokens = _result[1];

        initialParsed = BigInteger(initialTokens.toString());
        finalParsed = BigInteger(finalTokens.toString());
        assert(finalParsed.minus(initialParsed).equals(BigInteger("200000000000000000000")), "Purchased tokens is correct");
      });
    });
  });

  // Hard cap
  describe('hard capping', function() {
    beforeEach(function() {
      return Promise.all([
        sale.setStart(days_ago(15)),
      ]);
    });

    it("should allow the owner to alter the hard cap", function() {
      return sale.hardcap().then(function(_hardcap) {
        assert.equal(250000 * ether, _hardcap);
        return sale.setHardcap(100000 * ether, {from: owner});
      }).then(function() {
        return sale.hardcap();
      }).then(function(_hardcap) {
        assert.equal(_hardcap, 100000 * ether, "Hardcap changed");
      });
    });

    it("should not allow anyone else to alter the hard cap", function() {
      return sale.hardcap().then(function(_hardcap) {
        assert.equal(250000 * ether, _hardcap);
        return sale.setHardcap(100000 * ether, {from: accounts[2]});
      }).catch(function(error) {
        return sale.hardcap();
      }).then(function(_hardcap) {
        assert.equal(_hardcap.valueOf(), 250000 * ether, "Hardcap unchanged");
      });
    });

    it("should not allow any more sales after the hard cap", function() {
      var initialTokens;
      var initialEthers;
      var finalTokens;
      var finalEthers;
      var buyer = accounts[0];
      return sale.setStart(days_ago(15)).then(function() {
        return Promise.all([
          getEthers(buyer),
          token.balanceOf(buyer),
          sale.setHardcap(0.005 * ether, {from: owner}),
        ]);
      }).then(function(_result) {
        initialEthers = _result[0];
        initialTokens = _result[1];
        return sale.sendTransaction({from: buyer, value: 1 * ether});
      }).catch(function(error) {
        return Promise.all([
          getEthers(buyer),
          token.balanceOf(buyer),
        ]);
      }).then(function(_result) {
        finalEthers = _result[0];
        finalTokens = _result[1];
        assert.equal(initialTokens.valueOf(), finalTokens.valueOf(), "Tokens did not change");
      });
    });

    it("should allow us to sell more tokens below the hard cap", function() {
      var initialTokens;
      var initialEthers;
      var finalTokens;
      var finalEthers;
      var buyer = accounts[0];
      return sale.setStart(days_ago(15)).then(function() {
        return Promise.all([
          getEthers(buyer),
          token.balanceOf(buyer),
          sale.setHardcap(5000 * ether, {from: owner}),
        ]);
      }).then(function(_result) {
        initialEthers = _result[0];
        initialTokens = _result[1];
        return sale.sendTransaction({from: buyer, value: 1 * ether});
      }).then(function(transaction) {
        return Promise.all([
          getEthers(buyer),
          token.balanceOf(buyer),
        ]);
      }).then(function(_result) {
        finalEthers = _result[0];
        finalTokens = _result[1];

        initialParsed = BigInteger(initialTokens.toString());
        finalParsed = BigInteger(finalTokens.toString());
        assert(finalParsed.minus(initialParsed).equals(BigInteger("200000000000000000000")), "Purchased tokens is correct");
      });
    });

    it("should respect the altDeposits", function() {
      var initialTokens;
      var initialEthers;
      var finalTokens;
      var finalEthers;
      var buyer = accounts[0];
      return sale.setStart(days_ago(15)).then(function() {
        return Promise.all([
          getEthers(buyer),
          token.balanceOf(buyer),
          sale.setAltDeposits(250000 * ether, {from: owner}),
        ]);
      }).then(function(_result) {
        initialEthers = _result[0];
        initialTokens = _result[1];
        return sale.sendTransaction({from: buyer, value: 1 * ether});
      }).catch(function(error) {
        return Promise.all([
          getEthers(buyer),
          token.balanceOf(buyer),
        ]);
      }).then(function(_result) {
        finalEthers = _result[0];
        finalTokens = _result[1];
        assert.equal(initialTokens.valueOf(), finalTokens.valueOf(), "Tokens did not change");
      });
    });
  });

  // Alt Deposits
  describe('alt deposits', function() {
    beforeEach(function() {
      return Promise.all([
        sale.setAltDeposits(0),
      ]);
    });

    it("should allow me to update alt deposits", function() {
      return sale.setAltDeposits(100 * ether).then(function() {
        return sale.altDeposits();
      }).then(function(_newAltDeposits) {
        assert.equal(_newAltDeposits.valueOf(), 100 * ether, "Date updated correctly");
      });
    });

    it("should not allow others to update alt deposits", function() {
      return sale.setAltDeposits(100 * ether, {from: accounts[2]}).catch(function(_error) {
        return sale.altDeposits();
      }).then(function(_newAltDeposits) {
        assert.equal(_newAltDeposits.valueOf(), 0, "Date not updated");
      });
    });
  });

  // Multisig vault
  describe('multisig vault', function() {
    beforeEach(function() {
      return Promise.all([
        sale.setMultisigVault(accounts[3]),
      ]);
    });

    it("should forward the money to the correct multisig vault", function() {
      var buyer = accounts[1];
      var multisig = accounts[3];
      var initialTokens;
      var initialEthers;
      var initialTokensVault;
      var initialEthersVault;
      var finalTokens;
      var finalEthers;
      var finalTokensVault;
      var finalEthersVault;
      return sale.setStart(days_ago(15)).then(function() {
        return sale.setMultisigVault(multisig, {from: owner});
      }).then(function() {
        return Promise.all([
          getEthers(buyer),
          token.balanceOf.call(buyer),
          getEthers(multisig),
          token.balanceOf.call(multisig),
        ]);
      }).then(function(_result) {
        initialEthers = _result[0];
        initialTokens = _result[1];
        initialEthersVault = _result[2];
        initialTokensVault = _result[3];
        return sale.sendTransaction({from: buyer, value: 1 * ether});
      }).then(function(transaction) {
        return Promise.all([
          getEthers(buyer),
          token.balanceOf.call(buyer),
          getEthers(multisig),
          token.balanceOf.call(multisig),
        ]);
      }).then(function(_result) {
        finalEthers = _result[0];
        finalTokens = _result[1];
        finalEthersVault = _result[2];
        finalTokensVault = _result[3];

        assert.isAbove(initialEthers.valueOf() - finalEthers.valueOf(), 1 * ether, "Spent a lot of ethers");
        assert.isBelow(initialEthers.valueOf() - finalEthers.valueOf(), 1.01 * ether, "Did not spent too much ethers");

        initialVaultParsed = BigInteger(initialEthersVault.toString());
        finalVaultParsed = BigInteger(finalEthersVault.toString());

        assert(finalVaultParsed.minus(initialVaultParsed).equals(BigInteger("1000000000000000000")), "Multisig Vault received ethers");
      });
    });

    it("should allow me to update the multisig vault", function() {
      return sale.setMultisigVault(accounts[4], {from: owner}).then(function() {
        return sale.multisigVault();
      }).then(function(_newMultisigVault) {
        assert.equal(_newMultisigVault, accounts[4], "MultisigVault updated correctly");
      });

    });

    it("should not allow others to update the multisig vault", function() {
      return sale.setMultisigVault(accounts[4], {from: accounts[1]}).catch(function(_error) {
        return sale.multisigVault();
      }).then(function(_newMultisigVault) {
        assert.notEqual(_newMultisigVault.valueOf(), accounts[4], "MultisigVault not updated");
      });
    });
  });

  // Authorized create tokens
  describe('authorized create tokens', function() {
    it("should allow me to create tokens for others", function() {
      var initialTokens;
      var initialEthers;
      var finalTokens;
      var finalEthers;
      var recipient = accounts[1];
      return sale.setStart(days_ago(15)).then(function() {
        return Promise.all([
          getEthers(recipient),
          token.balanceOf(recipient),
        ]);
      }).then(function(_result) {
        initialEthers = _result[0];
        initialTokens = _result[1];
        return sale.authorizedCreateTokens(recipient, 1 * units, {from: owner});
      }).then(function(transaction) {
        return Promise.all([
          getEthers(recipient),
          token.balanceOf(recipient),
        ]);
      }).then(function(_result) {
        finalEthers = _result[0];
        finalTokens = _result[1];

        assert.equal(finalTokens.valueOf() - initialTokens.valueOf(), 1 * units, "Tokens received");
      });
    });

    it("should not allow others to create tokens", function() {
      var initialTokens;
      var initialEthers;
      var finalTokens;
      var finalEthers;
      var recipient = accounts[1];
      return sale.setStart(days_ago(15)).then(function() {
        return Promise.all([
          getEthers(recipient),
          token.balanceOf(recipient),
        ]);
      }).then(function(_result) {
        initialEthers = _result[0];
        initialTokens = _result[1];
        return sale.authorizedCreateTokens(recipient, 1 * units, {from: accounts[3]});
      }).catch(function(error) {
        return Promise.all([
          getEthers(recipient),
          token.balanceOf(recipient),
        ]);
      }).then(function(_result) {
        finalEthers = _result[0];
        finalTokens = _result[1];

        assert.equal(initialTokens.valueOf(), finalTokens.valueOf(), "Tokens did not change received");
      });
    });
  });

  describe("finish minting by others", function() {
    it("should not be allowed", function() {
      return sale.finishMinting({from: accounts[3]}).then(function() {
        assert(false, "This should not succeed");
      }).catch(function(error) {
        return token.mintingFinished();
      }).then(function(_mintingFinished) {
        assert.equal(_mintingFinished.valueOf(), false, "Minting should not be finished");
      });
    });
  });

  // Finish minting
  describe("finish minting", function() {
    it("should transfer ownership of the token", function() {
      var originalOwner;
      return token.owner().then(function(_owner) {
        originalOwner = _owner;
        return sale.finishMinting({from: owner});
      }).then(function() {
        return Promise.all([
          token.owner(),
          token.mintingFinished(),
        ]);
      }).then(function(_result) {
        var newOwner = _result[0];
        var mintingFinished = _result[1];

        assert.equal(originalOwner, sale.address, "The original owner of the token should be the contract address")
        assert.notEqual(originalOwner, owner, "The original owner of the token should not be the owner of the contract");
        assert.equal(newOwner, owner, "The owner of the contract should now own the token");
        assert.equal(mintingFinished, true, "Minting should be finished");
      });
    });
  });
});
