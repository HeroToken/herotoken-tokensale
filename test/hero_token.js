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

var closeEnough = function(a, b, fraction) {
  var diff = Math.abs(a - b) / Math.max(a, b);
  return diff < fraction;
}

contract('HeroToken', function(accounts) {
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
    }).then(function() {
      return Promise.all([
        sale.authorizedCreateTokens(accounts[0], 1 * units, {from: owner}),
        sale.authorizedCreateTokens(accounts[1], 1 * units, {from: owner}),
        sale.authorizedCreateTokens(accounts[2], 1 * units, {from: owner}),
      ]);
    });
  });

  describe("before trading started", function() {
    beforeEach(function() {
      return sale.finishMinting({from: owner});
    })
    it("should not allow transfer to work", function() {
      var initialTokens0;
      var initialTokens1;
      var finalTokens0;
      var finalTokens1;
      return Promise.all([
        token.balanceOf(accounts[0]),
        token.balanceOf(accounts[1]),
      ]).then(function(_result) {
        initialTokens0 = _result[0];
        initialTokens1 = _result[1];
        return token.transfer(accounts[0], accounts[1]);
      }).then(function() {
        assert(false, "Transfer should not have worked");
      }).catch(function(error) {
        return Promise.all([
          token.balanceOf(accounts[0]),
          token.balanceOf(accounts[1]),
        ]);
      }).then(function(_result) {
        finalTokens0 = _result[0];
        finalTokens1 = _result[1];
        assert.equal(initialTokens0.valueOf(), finalTokens0.valueOf(), "Tokens should not have been transfered");
        assert.equal(initialTokens1.valueOf(), finalTokens1.valueOf(), "Tokens should not have been transfered");
      });
    });

    it("should not allow transferFrom to work", function() {
      var initialTokens0;
      var initialTokens1;
      var allowance02;
      var finalTokens0;
      var finalTokens1;
      var finalAllowance02;
      return token.approve(accounts[2], 1 * units, {from: accounts[0]}).then(function() {
        return Promise.all([
          token.balanceOf(accounts[0]),
          token.balanceOf(accounts[1]),
          token.allowance(accounts[0], accounts[2]),
        ]);
      }).then(function(_result) {
        initialTokens0 = _result[0];
        initialTokens1 = _result[1];
        allowance02 = _result[2];
        return token.transferFrom(accounts[0], accounts[1], 0.5 * units, {from: accounts[2]});
      }).then(function() {
        assert(false, "Transfer from should not have worked");
      }).catch(function(error) {
        return Promise.all([
          token.balanceOf(accounts[0]),
          token.balanceOf(accounts[1]),
          token.allowance(accounts[0], accounts[2]),
        ]);
      }).then(function(_result) {
        finalTokens0 = _result[0];
        finalTokens1 = _result[1];
        finalAllowance02 = _result[2];

        assert.equal(initialTokens0.valueOf(), finalTokens0.valueOf(), "Tokens should not have been transfered");
        assert.equal(initialTokens1.valueOf(), finalTokens1.valueOf(), "Tokens should not have been transfered");
        assert.equal(allowance02.valueOf(), finalAllowance02.valueOf(), "Allowance should not have been spent");
      });
    });
  });

  describe('after trading started', function() {
    beforeEach(function() {
      return sale.finishMinting().then(function() {
        token.startTrading({from: owner});
      });
    });

    it("should allow transferring tokens when trading has started", function() {
      var initialTokens0;
      var initialTokens1;
      var finalTokens0;
      var finalTokens1;
      return Promise.all([
        token.balanceOf(accounts[0]),
        token.balanceOf(accounts[1]),
      ]).then(function(_result) {
        initialTokens0 = _result[0];
        initialTokens1 = _result[1];
        return token.transfer(accounts[1], 0.5 * units, {from: accounts[0]});
      }).then(function(transaction) {
        return Promise.all([
          token.balanceOf(accounts[0]),
          token.balanceOf(accounts[1]),
        ]);
      }).then(function(_result) {
        finalTokens0 = _result[0];
        finalTokens1 = _result[1];

        initialParsed0 = BigInteger(initialTokens0.toString());
        initialParsed1 = BigInteger(initialTokens1.toString());
        finalParsed0 = BigInteger(finalTokens0.toString());
        finalParsed1 = BigInteger(finalTokens1.toString());

        assert(finalParsed0.minus(initialParsed0).equals(BigInteger("-500000000000000000")), "Tokens should have been deducted");
        assert(finalParsed1.minus(initialParsed1).equals(BigInteger("500000000000000000")), "Tokens should have been added");
      });
    });

    it("should allow transferFrom to work", function() {
      var initialTokens0;
      var initialTokens1;
      var allowance02;
      var finalTokens0;
      var finalTokens1;
      var finalAllowance02;
      return token.approve(accounts[2], 0, {from: accounts[0]}).then(function() {
        return token.approve(accounts[2], 1 * units, {from: accounts[0]});
      }).then(function() {
        return Promise.all([
          token.balanceOf(accounts[0]),
          token.balanceOf(accounts[1]),
          token.allowance(accounts[0], accounts[2]),
        ]);
      }).then(function(_result) {
        initialTokens0 = _result[0];
        initialTokens1 = _result[1];
        allowance02 = _result[2];
        return token.transferFrom(accounts[0], accounts[1], 0.5 * units, {from: accounts[2]});
      }).then(function() {
        return Promise.all([
          token.balanceOf(accounts[0]),
          token.balanceOf(accounts[1]),
          token.allowance(accounts[0], accounts[2]),
        ]);
      }).then(function(_result) {
        finalTokens0 = _result[0];
        finalTokens1 = _result[1];
        finalAllowance02 = _result[2];

        initialParsed0 = BigInteger(initialTokens0.toString());
        initialParsed1 = BigInteger(initialTokens1.toString());
        finalParsed0 = BigInteger(finalTokens0.toString());
        finalParsed1 = BigInteger(finalTokens1.toString());

        allowanceParsed02 = BigInteger(allowance02.toString());
        finalAllowanceParsed02 = BigInteger(finalAllowance02.toString());

        assert(finalParsed0.minus(initialParsed0).equals(BigInteger("-500000000000000000")), "Tokens should have been deducted");
        assert(finalParsed1.minus(initialParsed1).equals(BigInteger("500000000000000000")), "Tokens should have been added");
        assert(finalAllowanceParsed02.minus(allowanceParsed02).equals(BigInteger("-500000000000000000")), "Allowance should have been spent");
      });
    });
  });

  describe('disbursement and claimability', function() {
    beforeEach(function() {
      return sale.authorizedCreateTokens(accounts[1], 1 * units, {from: owner});
    })

    it("should determine the correct money after disbursement and claiming", function() {
      var initialEthers;
      return token.disburse({value: 1 * ether}).then(function() {
        return Promise.all([
          token.claimable(accounts[0]),
          token.claimable(accounts[1]),
          token.claimable(accounts[2]),
          getEthers(accounts[1]),
        ]).then(function(_results) {
          initialEthers = _results[3];

          assert.equal(_results[0].valueOf(), 0.25 * ether, "First account gets one fourth");
          assert.equal(_results[1].valueOf(), 0.50 * ether, "Second account gets one half");
          assert.equal(_results[2].valueOf(), 0.25 * ether, "Third account gets one fourth");

          return token.claim(0.40 * ether, {from: accounts[1]});
        }).then(function(_results) {
          return Promise.all([
            token.claimable(accounts[0]),
            token.claimable(accounts[1]),
            token.claimable(accounts[2]),
            getEthers(accounts[1]),
          ]);
        }).then(function(_results) {
          assert.equal(_results[0].valueOf(), 0.25 * ether, "First account gets one fourth");
          assert.equal(_results[1].valueOf(), 0.10 * ether, "Second account has none left");
          assert.equal(_results[2].valueOf(), 0.25 * ether, "Third account gets one fourth");

          var etherChange = _results[3].valueOf() - initialEthers.valueOf();
          assert(closeEnough(etherChange, 0.40 * ether, 0.01), "Second account gained about 0.40 eth");
        });
      })
    });

    it("should disburse money sent to the contract", function() {
      return token.sendTransaction({value: 1 * ether}).then(function() {
        return Promise.all([
          token.claimable(accounts[0]),
          token.claimable(accounts[1]),
          token.claimable(accounts[2]),
        ]).then(function(_results) {
          assert.equal(_results[0].valueOf(), 0.25 * ether, "First account gets one fourth");
          assert.equal(_results[1].valueOf(), 0.50 * ether, "Second account gets one half");
          assert.equal(_results[2].valueOf(), 0.25 * ether, "Third account gets one fourth");
        });
      });
    });

    it("should handle complex situations correctly", function() {
      // Account 0 has 1 unit
      // Account 1 has 2 units
      // Account 2 has 1 unit
      // Account 3 has 0 units
      var eth0, eth1, eth2, eth3;
      return token.disburse({value: 1 * ether}).then(function() {
        return Promise.all([
          token.claimable(accounts[0]),
          token.claimable(accounts[1]),
          token.claimable(accounts[2]),
          token.claimable(accounts[3]),
          getEthers(accounts[0]),
          getEthers(accounts[1]),
          getEthers(accounts[2]),
          getEthers(accounts[3]),
        ]).then(function(_results) {
          eth0 = _results[4];
          eth1 = _results[5];
          eth2 = _results[6];
          eth3 = _results[7];

          assert.equal(_results[0].valueOf(), 0.25 * ether, "1st account gets 0.25 eth");
          assert.equal(_results[1].valueOf(), 0.50 * ether, "2nd account gets 0.50 eth");
          assert.equal(_results[2].valueOf(), 0.25 * ether, "3rd account gets 0.25 eth");
          assert.equal(_results[3].valueOf(), 0.00 * ether, "4th account gets 0.00 eth");

          return Promise.all([
            sale.authorizedCreateTokens(accounts[0], 1 * units, {from: owner}),
            token.claim(0.25 * ether, {from: accounts[1]}),
            sale.authorizedCreateTokens(accounts[3], 5 * units, {from: owner}),
            // Account 0 has 2 units
            // Account 1 has 2 units and claimed 0.25 eth
            // Account 2 has 1 units
            // Account 3 has 5 units
          ]);
        }).then(function(_results) {
          return token.disburse({value: 5 * ether});
        }).then(function(_results) {
          return Promise.all([
            token.claimable(accounts[0]),
            token.claimable(accounts[1]),
            token.claimable(accounts[2]),
            token.claimable(accounts[3]),
            getEthers(accounts[0]),
            getEthers(accounts[1]),
            getEthers(accounts[2]),
            getEthers(accounts[3]),
          ]);
        }).then(function(_results) {
          assert.equal(_results[0].valueOf(), 1.25 * ether, "1st account gets this much");
          assert.equal(_results[1].valueOf(), 1.25 * ether, "2nd account gets this much");
          assert.equal(_results[2].valueOf(), 0.75 * ether, "3rd account gets this much");
          assert.equal(_results[3].valueOf(), 2.50 * ether, "4th account gets this much");

          var etherChange = _results[5].valueOf() - eth1.valueOf();
          assert(closeEnough(etherChange, 0.25 * ether, 0.01), "Second account gained about 0.40 eth");

          return sale.finishMinting();
        }).then(function() {
          return token.startTrading();
        }).then(function() {
          return Promise.all([
            token.transfer(accounts[2], 1 * units, {from: accounts[0]}), // Account 0 now has 1 unit
            token.transfer(accounts[3], 1 * units, {from: accounts[0]}), // Account 1 now has 0 units
            token.transfer(accounts[0], 1 * units, {from: accounts[1]}), // Account 2 now has 2 units
            token.transfer(accounts[3], 1 * units, {from: accounts[1]}), // Account 3 now has 7 units
          ]);
        }).then(function() {
          return Promise.all([
            token.disburse({value: 5 * ether}),
            token.disburse({value: 2 * ether}),
            token.disburse({value: 1 * ether}),
            token.disburse({value: 2 * ether}),
          ]);
        }).then(function() {
          return Promise.all([
            token.claimable(accounts[0]),
            token.claimable(accounts[1]),
            token.claimable(accounts[2]),
            token.claimable(accounts[3]),
            getEthers(accounts[0]),
            getEthers(accounts[1]),
            getEthers(accounts[2]),
            getEthers(accounts[3]),
          ]);
        }).then(function(_results) {
          assert.equal(_results[0].valueOf(), 2.25 * ether, "1st account gets this much");
          assert.equal(_results[1].valueOf(), 1.25 * ether, "2nd account gets this much");
          assert.equal(_results[2].valueOf(), 2.75 * ether, "3rd account gets this much");
          assert.equal(_results[3].valueOf(), 9.50 * ether, "4th account gets this much");
        });
      })
    });

    it("should not let people claim more than they have", function() {
      return token.disburse({value: 1 * ether}).then(function() {
        return token.claim(0.51 * ether, {from: accounts[1]});
      }).then(function() {
        assert(false, "This should not succeed");
      }).catch(function(error) {
        return token.claimable(accounts[1]);
      }).then(function(_result) {
        assert.equal(_result.valueOf(), 0.50 * ether, "Second account should not have changed");
      });
    });

    it("should not allow negative claims", function() {
      return token.disburse({value: 1 * ether}).then(function() {
        return token.claim(-0.01 * ether, {from: accounts[1]});
      }).then(function() {
        assert(false, "This should not succeed");
      }).catch(function(error) {
        return token.claimable(accounts[1]);
      }).then(function(_result) {
        assert.equal(_result.valueOf(), 0.50 * ether, "Second account should not have changed");
      });
    });
  });
});
