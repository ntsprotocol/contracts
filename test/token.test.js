const web3 = require('web3');
const {accounts, contract} = require('@openzeppelin/test-environment');
const {BN, expectRevert, time, expectEvent, constants} = require('@openzeppelin/test-helpers');
const {expect} = require('chai');
const Token = contract.fromArtifact('PtsToken');
let _deployer, _fee_manager, _fee_address, _mint_to, _farm_dev, _farm_fee_treasure;
const mintAmount = '80000';
const _name = 'TestToken';//
const _symbol = 'TST';
const _fee_bp = '100';
const _mint_amount = web3.utils.toWei(mintAmount);

describe('Token', function () {
    beforeEach(async function () {
        _deployer = accounts[0];
        _fee_manager = accounts[0];
        _fee_address = accounts[1];
        _mint_to = accounts[2];
        _farm_dev = accounts[3];
        _farm_fee_treasure = accounts[4];

        this.Token = await Token.new(_name, _symbol,
            _fee_manager, _fee_address,
            _fee_bp, _mint_amount, _mint_to, {from: _deployer, gas: 8000000});
    });

    describe('TEST BEP20 DEFAULTS', function () {
        it('testSymbolAndName', async function () {
            const name = await this.Token.name();
            const symbol = await this.Token.symbol();
            expect(_name).to.be.equal(name);
            expect(_symbol).to.be.equal(symbol);
        });
    });

    describe('TEST INITAL MINTED SUPPLY', function () {
        it('mintAmount=minted', async function () {
            const getMintedAddress = await this.Token.getMintedAddress();
            const minted = await this.Token.balanceOf(getMintedAddress);
            expect(minted).to.be.bignumber.equal(_mint_amount);
        });
        it('mintAmount=totalSupply', async function () {
            const totalSupply = await this.Token.totalSupply();
            expect(_mint_amount).to.be.bignumber.equal(totalSupply);
        });
    });

    describe('TEST FEE', function () {
        it('_fee_bp=getFee', async function () {
            const getFee = await this.Token.getFee();
            expect(_fee_bp).to.be.bignumber.equal(getFee);
        });
        it('new_fee=1000', async function () {
            const new_fee = '1000';
            await this.Token.set_fee_points(new_fee, {from: _deployer});
            const getFee = await this.Token.getFee();
            expect(new_fee).to.be.bignumber.equal(getFee);
        });
        it('new_fee>1000', async function () {
            const new_fee = '1001';
            await expectRevert(this.Token.set_fee_points(new_fee, {from: _fee_manager}), 'invalid fee');
        });
        it('sender!=_fee_manager', async function () {
            await expectRevert(this.Token.set_fee_points('1000', {from: _mint_to}), 'access-denied');
        });
        it('set_fee_manager', async function () {
            await expectRevert(this.Token.set_fee_manager(_mint_to, {from: _mint_to}), 'access-denied');
            await this.Token.set_fee_manager(_mint_to, {from: _fee_manager});
            const getFeeManager = await this.Token.getFeeManager();
            expect(_mint_to).to.be.bignumber.equal(getFeeManager);
        });
        it('set_fee_address', async function () {
            await expectRevert(this.Token.set_fee_address(_mint_to, {from: _mint_to}), 'access-denied');
            await this.Token.set_fee_address(_mint_to, {from: _fee_manager});
            const getFeeAddress = await this.Token.getFeeAddress();
            expect(_mint_to).to.be.bignumber.equal(getFeeAddress);
        });
    });

    describe('TEST WHITELIST', function () {

        it('whitelist of any user must be false', async function () {
            const isWhitelisted = await this.Token.isWhitelisted(_mint_to);
            expect(isWhitelisted).to.be.equal(false);
        });

        it('do not allow any user to whitelist', async function () {
            await expectRevert(this.Token.whitelist_address(_mint_to, true, {from: _mint_to}), 'access-denied');
        });

        it('allow manager to whitelist', async function () {
            await this.Token.whitelist_address(_mint_to, true, {from: _fee_manager});
            const isWhitelisted = await this.Token.isWhitelisted(_mint_to);
            expect(isWhitelisted).to.be.equal(true);
        });

    });

    describe('TEST MINTING', function () {

        it('do not allow any user to mint', async function () {
            await expectRevert(this.Token.mint(_mint_to, mintAmount, {from: _mint_to}), 'Ownable: caller is not the owner');
        });

        it('deployer can mint', async function () {
            const mintMore = web3.utils.toWei(mintAmount);
            await this.Token.mint(_deployer, mintMore, {from: _deployer});

            const totalSupply = await this.Token.totalSupply();
            const newSupply = web3.utils.toWei(new BN(mintAmount * 2));
            expect(newSupply).to.be.bignumber.equal(totalSupply);

            const minted = await this.Token.balanceOf(_deployer);
            expect(minted).to.be.bignumber.equal(mintMore);

        });

    });

    describe('TEST TRANSFER', function () {
        const amount = new BN(100);
        it('no balance to transfer', async function () {
            await expectRevert(this.Token.transfer(_mint_to, amount, {from: _deployer}), 'BEP20: transfer amount exceeds balance');
        });
        it('allow transfer + fee non whitelisted', async function () {
            await this.Token.transfer(_deployer, amount, {from: _mint_to});
            const balanceOf = await this.Token.balanceOf(_deployer);
            const fee = new BN( (amount*_fee_bp)/10000 );
            const received = amount.sub(fee);
            expect(received).to.be.bignumber.equal(balanceOf);
        });
        it('allow transfer + fee + whitelisted', async function () {

            await this.Token.whitelist_address(_deployer, true, {from: _fee_manager});
            const isWhitelisted = await this.Token.isWhitelisted(_deployer);
            expect(isWhitelisted).to.be.equal(true);

            await this.Token.transfer(_deployer, amount, {from: _mint_to});
            const balanceOf = await this.Token.balanceOf(_deployer);
            expect(amount).to.be.bignumber.equal(balanceOf);
        });
    });

});
