pragma solidity ^0.4.18;

import 'zeppelin-solidity/contracts/math/SafeMath.sol';
import 'zeppelin-solidity/contracts/ownership/Ownable.sol';

/**
 * Token
 *
 * @title A fixed supply ERC-20 token contract with crowdsale capability.
 * https://github.com/ethereum/EIPs/blob/master/EIPS/eip-20.md
 */
contract Token is Ownable {
    using SafeMath for uint;
    uint public constant MAX_UINT =
        0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF;

    struct Crowdsale {
        bool open;
        uint initialTokenSupply;
        uint tokenBalance;
        uint exchangeRate;
        uint startTime;
        uint endTime;
    }

    event CrowdsaleDeployed(
        string crowdsaleName,
        bool indexed open,
        uint initialTokenSupply,
        uint exchangeRate,
        uint indexed startTime,
        uint endTime
    );

    event TokenNameChanged(
        string previousName,
        string newName,
        uint indexed time
    );

    event TokenSymbolChanged(
        string previousSymbol,
        string newSymbol,
        uint indexed time
    );

    event Transfer(
        address indexed _from,
        address indexed _to,
        uint256 _value
    );

    event Approval(
        address indexed _owner,
        address indexed _spender,
        uint256 _value
    );

    string public symbol;
    string public name;
    uint8 public decimals;
    uint public totalSupply;

    mapping(address => uint) balances;
    mapping(address => mapping(address => uint)) allowed;
    mapping(string => Crowdsale) crowdsales;

    /**
     * Constructs the Token contract and gives all of the supply to the address
     *     that deployed it. The fixed supply is 1 billion tokens with up to 18
     *     decimal places.
     */
    function Token() public {
        symbol = 'TOK';
        name = 'Token';
        decimals = 18;
        totalSupply = 1000000000 * 10**uint(decimals);
        balances[msg.sender] = totalSupply;
        Transfer(address(0), msg.sender, totalSupply);
    }

    /**
     * @dev Fallback function
     */
    function() public payable { revert(); }

    /**
     * Gets the token balance of any wallet.
     * @param _owner Wallet address of the returned token balance.
     * @return The balance of tokens in the wallet.
     */
    function balanceOf(address _owner)
        public
        constant
        returns (uint balance)
    {
        return balances[_owner];
    }

    /**
     * Transfers tokens from the sender's wallet to the specified `_to` wallet.
     * @param _to Address of the transfer's recipient.
     * @param _value Number of tokens to transfer.
     * @return True if the transfer succeeded.
     */
    function transfer(address _to, uint _value) public returns (bool success) {
        balances[msg.sender] = balances[msg.sender].sub(_value);
        balances[_to] = balances[_to].add(_value);
        Transfer(msg.sender, _to, _value);
        return true;
    }

    /**
     * Transfer tokens from any wallet to the `_to` wallet. This only works if
     *     the `_from` wallet has already allocated tokens for the caller keyset
     *     using `approve`. From wallet must have sufficient balance to
     *     transfer. Caller must have sufficient allowance to transfer.
     * @param _from Wallet address that tokens are withdrawn from.
     * @param _to Wallet address that tokens are deposited to.
     * @param _value Number of tokens transacted.
     * @return True if the transfer succeeded.
     */
    function transferFrom(address _from, address _to, uint _value)
        public
        returns (bool success)
    {
        balances[_from] = balances[_from].sub(_value);
        allowed[_from][msg.sender] = allowed[_from][msg.sender].sub(_value);
        balances[_to] = balances[_to].add(_value);
        Transfer(_from, _to, _value);
        return true;
    }

    /**
     * Sender allows another wallet to `transferFrom` tokens from their wallet.
     * @param _spender Address of `transferFrom` recipient.
     * @param _value Number of tokens to `transferFrom`.
     * @return True if the approval succeeded.
     */
    function approve(address _spender, uint _value)
        public
        returns (bool success)
    {
        allowed[msg.sender][_spender] = _value;
        Approval(msg.sender, _spender, _value);
        return true;
    }

    /**
     * Gets the number of tokens that a `_owner` has approved for a _spender
     *     to `transferFrom`.
     * @param _owner Wallet address that tokens can be withdrawn from.
     * @param _spender Wallet address that tokens can be deposited to.
     * @return The number of tokens allowed to be transferred.
     */
    function allowance(address _owner, address _spender)
        public
        constant
        returns (uint remaining)
    {
        return allowed[_owner][_spender];
    }

    /**
     * Changes the token's name. Does not check for improper characters.
     * @param newName String of the new name for the token.
     */
    function changeTokenName(string newName) public onlyOwner {
        require(bytes(newName).length > 0);
        string memory oldName = name;
        name = newName;
        TokenNameChanged(oldName, newName, now);
    }

    /**
     * Changes the token's symbol. Does not check for improper characters.
     * @param newSymbol String of the new symbol for the token. 
     */
    function changeTokenSymbol(string newSymbol) public onlyOwner {
        require(bytes(newSymbol).length > 0);
        string memory oldSymbol = symbol;
        symbol = newSymbol;
        TokenSymbolChanged(oldSymbol, newSymbol, now);
    }

    /**
     * Creates a crowdsale. Tokens are withdrawn from the owner's account and
     *     the balance is kept track of by the `tokenBalance` of the crowdsale.
     *     A crowdsale can be opened or closed at any time by the owner using
     *     the `openCrowdsale` and `closeCrowdsale` methods. The `open`,
     *     `startTime`, and `endTime` properties are checked when a purchase is
     *     attempted. Crowdsales permanently exist in the `crowdsales` map. If
     *     the `endTime` for a crowdsale in the map is `0` the ncrowdsale does
     *     not exist.
     * @param crowdsaleName String name of the crowdsale. Used as the
     *     map key for a crowdsale struct instance in the `crowdsales` map.
     *     A name can be used once and only once to initialize a crowdsale.
     * @param open Boolean of openness; can be changed at any time by the owner.
     * @param initialTokenSupply Number of tokens the crowdsale is deployed
     *     with. This amount is a wei integer.
     * @param exchangeRate Token wei to Ethereum wei ratio.
     * @param startTime Unix epoch time in seconds for crowdsale start time.
     * @param endTime Unix epoch time in seconds for crowdsale end time. Any
     *     uint256 can be used to set this however passing `0` will cause the
     *     value to be set to the maximum uint256. If `0` is not passed, the
     *     value must be greater than `startTime`.
     */
    function createCrowdsale(
        string crowdsaleName,
        bool open,
        uint initialTokenSupply,
        uint exchangeRate,
        uint startTime,
        uint endTime
    )
        public
        onlyOwner
    {
        require(
            initialTokenSupply > 0 && initialTokenSupply <= balances[owner]
        );
        require(bytes(crowdsaleName).length > 0);
        require(crowdsales[crowdsaleName].endTime == 0);
        require(exchangeRate > 0);

        if (endTime == 0) {
            endTime = MAX_UINT;
        }

        require(endTime > startTime);

        crowdsales[crowdsaleName] = Crowdsale({
            open: open,
            initialTokenSupply: initialTokenSupply,
            tokenBalance: initialTokenSupply,
            exchangeRate: exchangeRate,
            startTime: startTime,
            endTime: endTime
        });

        balances[owner] = balances[owner].sub(initialTokenSupply);

        CrowdsaleDeployed(
            crowdsaleName,
            open,
            initialTokenSupply,
            exchangeRate,
            startTime,
            endTime
        );
    }

    /**
     * Owner can change the crowdsale's `open` property to true at any time.
     *     Only works on deployed crowdsales.
     * @param crowdsaleName String for the name of the crowdsale. Used as the
     *     map key to find a crowdsale struct instance in the `crowdsales` map.
     * @return True if the open succeeded.
     */
    function openCrowdsale(string crowdsaleName)
        public
        onlyOwner
        returns (bool success)
    {
        require(crowdsales[crowdsaleName].endTime > 0);
        crowdsales[crowdsaleName].open = true;
        return true;
    }
    
    /**
     * Owner can change the crowdsale's `open` property to false at any time.
     *     Only works on deployed crowdsales.
     * @param crowdsaleName String for the name of the crowdsale. Used as the
     *     map key to find a crowdsale struct instance in the `crowdsales` map.
     * @return True if the close succeeded.
     */
    function closeCrowdsale(string crowdsaleName)
        public
        onlyOwner
        returns (bool success)
    {
        require(crowdsales[crowdsaleName].endTime > 0);
        crowdsales[crowdsaleName].open = false;
        return true;
    }

    /**
     * Owner can add tokens to the crowdsale after it is deployed. Owner must
     *     have enough tokens in their balance for this method to succeed.
     * @param crowdsaleName String for the name of the crowdsale. Used as the
     *     map key to find a crowdsale struct instance in the `crowdsales` map.
     * @param tokens Number of tokens to transfer from the owner to the
     *     crowdsale's `tokenBalance` property.
     * @return True if the add succeeded.
     */
    function crowdsaleAddTokens(string crowdsaleName, uint tokens)
        public
        onlyOwner
        returns (bool success)
    {
        require(crowdsales[crowdsaleName].endTime > 0);
        require(balances[owner] >= tokens);

        balances[owner] = balances[owner].sub(tokens);
        crowdsales[crowdsaleName].tokenBalance = 
            crowdsales[crowdsaleName].tokenBalance.add(tokens);

        Transfer(owner, address(this), tokens);
        return true;
    }

    /**
     * Owner can remove tokens from the crowdsale at any time. Crowdsale must
     *      have enough tokens in its balance for this method to succeed.
     * @param crowdsaleName String for the name of the crowdsale. Used as the
     *     map key to find a crowdsale struct instance in the `crowdsales` map.
     * @param tokens Number of tokens to transfer from the crowdsale
     *      `tokenBalance` to the owner.
     * @return True if the remove succeeded.
     */
    function crowdsaleRemoveTokens(string crowdsaleName, uint tokens)
        public
        onlyOwner
        returns (bool success)
    {
        require(crowdsales[crowdsaleName].endTime > 0);
        require(crowdsales[crowdsaleName].tokenBalance >= tokens);

        balances[owner] = balances[owner].add(tokens);
        crowdsales[crowdsaleName].tokenBalance = 
            crowdsales[crowdsaleName].tokenBalance.sub(tokens);

        Transfer(address(this), owner, tokens);
        return true;
    }

    /**
     * Owner can change the crowdsale's `exchangeRate` after it is deployed.
     * @param crowdsaleName String for the name of the crowdsale. Used as the
     *     map key to find a crowdsale struct instance in the `crowdsales` map.
     * @param newExchangeRate Ratio of token wei to Ethereum wei for crowdsale
     *     purchases.
     * @return True if the update succeeded.
     */
    function crowdsaleUpdateExchangeRate(
        string crowdsaleName,
        uint newExchangeRate
    )
        public
        onlyOwner
        returns (bool success)
    {
        // Only works on crowdsales that exist
        require(crowdsales[crowdsaleName].endTime > 0);
        crowdsales[crowdsaleName].exchangeRate = newExchangeRate;
        return true;
    }

    /**
     * Any wallet can purchase tokens using ether if the crowdsale is open. Note
     *     that the math operations assume the operands are Ethereum wei and
     *     Token wei.
     * @param crowdsaleName String for the name of the crowdsale. Used as the
     *     map key to find a crowdsale struct instance in the `crowdsales` map.
     * @param beneficiary Address of the wallet that will receive the tokens from
     *     the purchase. This can be any wallet address.
     * @return True if the purchase succeeded.
     */
    function crowdsalePurchase(
        string crowdsaleName,
        address beneficiary
    )
        public
        payable
        returns (bool success)
    {
        require(crowdsaleIsOpen(crowdsaleName));

        uint tokens = crowdsales[crowdsaleName].exchangeRate.mul(msg.value);
        require(crowdsales[crowdsaleName].tokenBalance >= tokens);

        crowdsales[crowdsaleName].tokenBalance =
            crowdsales[crowdsaleName].tokenBalance.sub(tokens);
        balances[beneficiary] = balances[beneficiary].add(tokens);

        Transfer(address(this), beneficiary, tokens);
        return true;
    }

    /**
     * Gets all the details for a declared crowdsale. If the passed name is not
     *     associated with an existing crowdsale, the call errors.
     * @param crowdsaleName String for the name of the crowdsale. Used as the
     *     map key to find a crowdsale struct instance in the `crowdsales` map.
     * @return Each member of a declared crowdsale struct.
     */
    function getCrowdsaleDetails(string crowdsaleName)
        public
        view
        returns
    (
        string name_,
        bool open,
        uint initialTokenSupply,
        uint tokenBalance,
        uint exchangeRate,
        uint startTime,
        uint endTime
    )
    {
        require(crowdsales[crowdsaleName].endTime > 0);
        return (
            crowdsaleName,
            crowdsales[crowdsaleName].open,
            crowdsales[crowdsaleName].initialTokenSupply,
            crowdsales[crowdsaleName].tokenBalance,
            crowdsales[crowdsaleName].exchangeRate,
            crowdsales[crowdsaleName].startTime,
            crowdsales[crowdsaleName].endTime
        );
    }

    /**
     * Gets the number of tokens the crowdsale has not yet sold.
     * @param crowdsaleName String for the name of the crowdsale. Used as the
     *     map key to find a crowdsale struct instance in the `crowdsales` map.
     * @return Total number of tokens the crowdsale has not yet sold.
     */
    function crowdsaleTokenBalance(string crowdsaleName)
        public
        view
        returns (uint)
    {
        require(crowdsales[crowdsaleName].endTime > 0);
        return crowdsales[crowdsaleName].tokenBalance;
    }

    /**
     * Check if the crowdsale is open.
     * @param crowdsaleName String for the name of the crowdsale. Used as the
     *     map key to find a crowdsale struct instance in the `crowdsales` map.
     * @return True if the crowdsale is open, false if it is closed.
     */
    function crowdsaleIsOpen(string crowdsaleName) public view returns (bool) {
        bool result = true;

        if (
            !crowdsales[crowdsaleName].open
            || crowdsales[crowdsaleName].startTime > now
            || crowdsales[crowdsaleName].endTime < now
        ) {
            result = false;
        }

        return result;
    }
}
