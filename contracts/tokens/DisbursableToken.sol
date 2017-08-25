pragma solidity ^0.4.13;

import "./MintableToken.sol";
import "../utilities/SafeMath.sol";

contract DisbursableToken is MintableToken {
  using SafeMath for uint256;

  struct Account {
    uint claimedPoints;
    uint allowedPoints;
    uint lastPointsPerToken;
  }

  event Disburse(address _source, uint _amount);
  event ClaimDisbursement(address _account, uint _amount);
  // The disbursement multiplier exists to correct rounding errors
  // One disbursed wei = 1e18 disbursement points
  uint pointMultiplier = 1e18;
  uint totalPointsPerToken;
  uint unclaimedDisbursement;
  uint totalDisbursement;

  mapping(address => Account) accounts;

  /**
   * @dev Function to send eth to owners of this token.
   */
  function disburse() public payable {
    totalPointsPerToken = totalPointsPerToken.add(msg.value.mul(pointMultiplier).div(totalSupply));
    unclaimedDisbursement = unclaimedDisbursement.add(msg.value);
    totalDisbursement = totalDisbursement.add(msg.value);
    Disburse(msg.sender, msg.value);
  }

  /**
   * @dev Function to update the claimable disbursements whenever tokens change hands
   * @param _account address The address whose claimable disbursements should be updated
   * @return A uint256 specifing the amount of wei still available for the owner.
   */
  function updatePoints(address _account) internal {
    uint newPointsPerToken = totalPointsPerToken.sub(accounts[_account].lastPointsPerToken);
    accounts[_account].allowedPoints = accounts[_account].allowedPoints.add(balances[_account].mul(newPointsPerToken));
    accounts[_account].lastPointsPerToken = totalPointsPerToken;
  }

  /**
   * @dev Function to check the amount of wei that a token owner can claim.
   * @param _owner address The address which owns the funds.
   * @return A uint256 specifing the amount of wei still available for the owner.
   */
  function claimable(address _owner) constant returns (uint256 remaining) {
    updatePoints(_owner);
    return accounts[_owner].allowedPoints.sub(accounts[_owner].claimedPoints).div(pointMultiplier);
  }

  /**
   * @dev Function to claim the wei that a token owner is entitled to
   * @param _amount uint256 How much of the wei the user will take
   */
  function claim(uint _amount) public {
    require(_amount > 0);
    updatePoints(msg.sender);
    uint claimingPoints = _amount.mul(pointMultiplier);
    require(accounts[msg.sender].claimedPoints.add(claimingPoints) <= accounts[msg.sender].allowedPoints);
    accounts[msg.sender].claimedPoints = accounts[msg.sender].claimedPoints.add(claimingPoints);
    ClaimDisbursement(msg.sender, _amount);
    require(msg.sender.send(_amount));
  }

  /**
   * @dev Function to mint tokens. We need to modify this to update points.
   * @param _to The address that will recieve the minted tokens.
   * @param _amount The amount of tokens to mint.
   * @return A boolean that indicates if the operation was successful.
   */
  function mint(address _to, uint256 _amount) onlyOwner canMint returns (bool) {
    updatePoints(_to);
    super.mint(_to, _amount);
  }

  function transfer(address _to, uint _value) returns(bool) {
    updatePoints(msg.sender);
    updatePoints(_to);
    super.transfer(_to, _value);
  }

  /**
   * @dev Transfer tokens from one address to another while ensuring that claims remain where they are
   * @param _from address The address which you want to send tokens from
   * @param _to address The address which you want to transfer to
   * @param _value uint256 the amout of tokens to be transfered
   */
  function transferFrom(address _from, address _to, uint _value) returns(bool) {
    updatePoints(_from);
    updatePoints(_to);
    super.transferFrom(_from, _to, _value);
  }
}

