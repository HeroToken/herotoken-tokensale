pragma solidity ^0.4.13;

import "./utilities/Ownable.sol";
import "./utilities/SafeMath.sol";
import "./HeroToken.sol";

/**
 * @title MainSale
 * @dev The main HERO token sale contract
 *
 * ABI
 * [{"constant":false,"inputs":[{"name":"_multisigVault","type":"address"}],"name":"setMultisigVault","outputs":[],"payable":false,"type":"function"},{"constant":true,"inputs":[],"name":"saleOngoing","outputs":[{"name":"","type":"bool"}],"payable":false,"type":"function"},{"constant":true,"inputs":[],"name":"exchangeRate","outputs":[{"name":"","type":"uint256"}],"payable":false,"type":"function"},{"constant":true,"inputs":[{"name":"base","type":"uint256"}],"name":"bonusTokens","outputs":[{"name":"","type":"uint256"}],"payable":false,"type":"function"},{"constant":true,"inputs":[],"name":"altDeposits","outputs":[{"name":"","type":"uint256"}],"payable":false,"type":"function"},{"constant":false,"inputs":[{"name":"recipient","type":"address"},{"name":"tokens","type":"uint256"}],"name":"authorizedCreateTokens","outputs":[],"payable":false,"type":"function"},{"constant":false,"inputs":[{"name":"_saleOngoing","type":"bool"}],"name":"setSaleOngoing","outputs":[],"payable":false,"type":"function"},{"constant":false,"inputs":[],"name":"finishMinting","outputs":[],"payable":false,"type":"function"},{"constant":true,"inputs":[],"name":"owner","outputs":[{"name":"","type":"address"}],"payable":false,"type":"function"},{"constant":false,"inputs":[{"name":"totalAltDeposits","type":"uint256"}],"name":"setAltDeposits","outputs":[],"payable":false,"type":"function"},{"constant":false,"inputs":[{"name":"_token","type":"address"}],"name":"retrieveTokens","outputs":[],"payable":false,"type":"function"},{"constant":true,"inputs":[],"name":"hardcap","outputs":[{"name":"","type":"uint256"}],"payable":false,"type":"function"},{"constant":true,"inputs":[],"name":"start","outputs":[{"name":"","type":"uint256"}],"payable":false,"type":"function"},{"constant":false,"inputs":[{"name":"recipient","type":"address"}],"name":"createTokens","outputs":[],"payable":true,"type":"function"},{"constant":true,"inputs":[],"name":"multisigVault","outputs":[{"name":"","type":"address"}],"payable":false,"type":"function"},{"constant":false,"inputs":[{"name":"_exchangeRate","type":"uint256"}],"name":"setExchangeRate","outputs":[],"payable":false,"type":"function"},{"constant":false,"inputs":[{"name":"_hardcap","type":"uint256"}],"name":"setHardcap","outputs":[],"payable":false,"type":"function"},{"constant":false,"inputs":[{"name":"newOwner","type":"address"}],"name":"transferOwnership","outputs":[],"payable":false,"type":"function"},{"constant":false,"inputs":[{"name":"_start","type":"uint256"}],"name":"setStart","outputs":[],"payable":false,"type":"function"},{"constant":true,"inputs":[],"name":"token","outputs":[{"name":"","type":"address"}],"payable":false,"type":"function"},{"payable":true,"type":"fallback"},{"anonymous":false,"inputs":[{"indexed":false,"name":"recipient","type":"address"},{"indexed":false,"name":"ether_amount","type":"uint256"},{"indexed":false,"name":"token_amount","type":"uint256"},{"indexed":false,"name":"exchangerate","type":"uint256"}],"name":"TokenSold","type":"event"},{"anonymous":false,"inputs":[{"indexed":false,"name":"recipient","type":"address"},{"indexed":false,"name":"token_amount","type":"uint256"}],"name":"AuthorizedCreate","type":"event"},{"anonymous":false,"inputs":[],"name":"MainSaleClosed","type":"event"}]
 */
contract MainSale is Ownable {
  using SafeMath for uint;
  event TokenSold(address recipient, uint ether_amount, uint token_amount, uint exchangerate);
  event AuthorizedCreate(address recipient, uint token_amount);
  event MainSaleClosed();

  HeroToken public token = new HeroToken();

  address public multisigVault;

  uint public hardcap = 250000 ether;
  uint public exchangeRate = 200;

  uint public altDeposits = 0;
  uint public start = 1609372800; //new Date("December 31, 2020 00:00:00").getTime() / 1000
  bool public saleOngoing = true;

  /**
   * @dev modifier to allow token creation only when the sale IS ON
   */
  modifier isSaleOn() {
    require(start < now && saleOngoing && !token.mintingFinished());
    _;
  }

  /**
   * @dev modifier to allow token creation only when the hardcap has not been reached
   */
  modifier isUnderHardcap() {
    require(multisigVault.balance + altDeposits <= hardcap);
    _;
  }

  /*
   * @dev Allows anyone to create tokens by depositing ether.
   * @param recipient the recipient to receive tokens.
   */
  function createTokens(address recipient) public isUnderHardcap isSaleOn payable {
    uint base = exchangeRate.mul(msg.value).mul(10**token.decimals()).div(1 ether);
    uint bonus = bonusTokens(base);
    uint tokens = base.add(bonus);
    token.mint(recipient, tokens);
    require(multisigVault.send(msg.value));
    TokenSold(recipient, msg.value, tokens, exchangeRate);
  }

  /**
   * @dev Computes the number of bonus tokens awarded based on the current time.
   * @param base the original number of tokens made without counting the bonus
   */
  function bonusTokens(uint base) constant returns(uint) {
    uint bonus = 0;
    if (now <= start + 3 hours) {
      bonus = base.mul(3).div(10);
    } else if (now <= start + 24 hours) {
      bonus = base.mul(2).div(10);
    } else if (now <= start + 3 days) {
      bonus = base.div(10);
    } else if (now <= start + 7 days) {
      bonus = base.div(20);
    } else if (now <= start + 14 days) {
      bonus = base.div(40);
    }
    return bonus;
  }

  /**
   * @dev Allows authorized acces to create tokens. This is used for Bitcoin and ERC20 deposits
   * @param recipient the recipient to receive tokens.
   * @param tokens number of tokens to be created.
   */
  function authorizedCreateTokens(address recipient, uint tokens) public onlyOwner {
    token.mint(recipient, tokens);
    AuthorizedCreate(recipient, tokens);
  }

  /**
   * @dev Allows the owner to set the starting time.
   * @param _start the new _start
   */
  function setStart(uint _start) public onlyOwner {
    start = _start;
  }

  /**
   * @dev Allows the owner to set the hardcap.
   * @param _hardcap the new hardcap
   */
  function setHardcap(uint _hardcap) public onlyOwner {
    hardcap = _hardcap;
  }

  /**
   * @dev Allows to set the toal alt deposit measured in ETH to make sure the hardcap includes other deposits
   * @param totalAltDeposits total amount ETH equivalent
   */
  function setAltDeposits(uint totalAltDeposits) public onlyOwner {
    altDeposits = totalAltDeposits;
  }

  /**
   * @dev Allows the owner to set the multisig contract.
   * @param _multisigVault the multisig contract address
   */
  function setMultisigVault(address _multisigVault) public onlyOwner {
    if (_multisigVault != address(0)) {
      multisigVault = _multisigVault;
    }
  }

  /**
   * @dev Allows the owner to set the exchange rate
   * @param _exchangeRate the exchangerate address
   */
  function setExchangeRate(uint _exchangeRate) public onlyOwner {
    exchangeRate = _exchangeRate;
  }

  /**
   * @dev Allows the owner to stop the sale
   * @param _saleOngoing whether the sale is ongoing or not
   */
  function setSaleOngoing(bool _saleOngoing) public onlyOwner {
    saleOngoing = _saleOngoing;
  }

  /**
   * @dev Allows the owner to finish the minting.
   * The ownership of the token contract is transfered
   * to this owner.
   */
  function finishMinting() public onlyOwner {
    token.finishMinting();
    token.transferOwnership(owner);
    MainSaleClosed();
  }

  /**
   * @dev Allows the owner to transfer ERC20 tokens to the multi sig vault
   * @param _token the contract address of the ERC20 contract
   */
  function retrieveTokens(address _token) public onlyOwner {
    ERC20 foreignToken = ERC20(_token);
    foreignToken.transfer(multisigVault, foreignToken.balanceOf(this));
  }

  /**
   * @dev Fallback function which receives ether and created the appropriate number of tokens for the
   * msg.sender.
   */
  function() external payable {
    createTokens(msg.sender);
  }
}
