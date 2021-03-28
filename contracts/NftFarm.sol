import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Counters.sol";
import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "./NFT.sol";
import "./libs/IBEP20.sol";
import "./libs/SafeBEP20.sol";

pragma solidity ^0.6.12;

contract NftFarm is Ownable {
    using SafeMath for uint8;
    using SafeMath for uint256;

    using SafeBEP20 for IBEP20;

    NFT public nft;
    IBEP20 public token;

    mapping(uint256 => bool) public hasClaimed;
    mapping(uint256 => address) public onwerById;
    uint256 public startBlockNumber;
    uint256 public endBlockNumber;
    uint256 public countBurnt;
    uint256 public tokenPerBurn;
    uint256 public currentDistributedSupply;
    uint256 public totalSupplyDistributed;
    string public baseURI;
    string public ipfsHash;
    mapping(uint8 => string) public nftIdURIs;
    uint8 public numberOfNftIds;

    event NftMint(address indexed to, uint256 indexed tokenId, uint8 indexed nftId);
    event NftBurn(address indexed from, uint256 indexed tokenId);

    constructor(
        NFT _nft,
        IBEP20 _token,
        uint256 _totalSupplyDistributed,
        uint256 _tokenPerBurn,
        string memory _baseURI,
        string memory _ipfsHash,
        uint256 _endBlockNumber
    ) public {
        nft = _nft;
        token = _token;
        totalSupplyDistributed = _totalSupplyDistributed;
        tokenPerBurn = _tokenPerBurn;
        baseURI = _baseURI;
        ipfsHash = _ipfsHash;
        endBlockNumber = _endBlockNumber;

    }
    function mintNFT(uint8 _nftId) external {
        require(hasClaimed[_nftId] == false, "Has claimed");
        require(currentDistributedSupply < totalSupplyDistributed, "Nothing left");
        require( startBlockNumber == 0 || block.number > startBlockNumber, "too early");
        token.safeTransferFrom(address(msg.sender), address(this), tokenPerBurn);
        hasClaimed[_nftId] = true;
        onwerById[_nftId] = msg.sender;
        currentDistributedSupply = currentDistributedSupply.add(1);

        // ipfs:// QmWB5xPBcFRn8qR4uu1VHt1k9vUrxvbezYv3jDC7WD29ie / 1 .json
        // uint256 tokenId = nft.mint(address(msg.sender), tokenURI, _nftId);
        string memory tokenURI = string(abi.encodePacked(ipfsHash, "/", _nftId, ".json"));
        uint256 tokenId = nft.mint(address(msg.sender), tokenURI, _nftId);

        emit NftMint(msg.sender, tokenId, _nftId);
    }
    function burnNFT(uint256 _tokenId) external {
        require(nft.ownerOf(_tokenId) == msg.sender, "Not the owner");
        require( endBlockNumber == 0 || block.number < endBlockNumber, "too late");
        nft.burn(_tokenId);
        countBurnt = countBurnt.add(1);
        token.safeTransfer(address(msg.sender), tokenPerBurn);
        emit NftBurn(msg.sender, _tokenId);
    }

    function adminSetInterval( uint256 _start, uint256 _end ) external onlyOwner {
        startBlockNumber = _start;
        endBlockNumber = _end;
    }
    function adminWithdrawToken(uint256 _amount) external onlyOwner {
        // comes from bunny: alow withdraw of tokens? need to discus with team
        token.safeTransfer(address(msg.sender), _amount);
    }
    function adminChangeToken(address _token) external onlyOwner {
        require( _token != address(0x0), "invalid address" );
        token = IBEP20(_token);
    }
    function adminSetTotalSupply(uint256 _totalSupplyDistributed) external onlyOwner {
        totalSupplyDistributed = _totalSupplyDistributed;
    }
    function adminSetTokenPerBurn(uint256 _tokenPerBurn) external onlyOwner {
        tokenPerBurn = _tokenPerBurn;
    }
    function adminSetBaseURI(string memory _baseURI) external onlyOwner {
        baseURI = _baseURI;
        nft.changeBaseURI(_baseURI);
    }


}
