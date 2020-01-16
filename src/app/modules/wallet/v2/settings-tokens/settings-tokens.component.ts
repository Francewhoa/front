import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  OnInit,
  OnDestroy,
  Input,
  Output,
  EventEmitter,
} from '@angular/core';
import { Router } from '@angular/router';
import {
  FormGroup,
  FormControl,
  Validators,
  AbstractControl,
} from '@angular/forms';

import { Client } from '../../../../services/api/client';
import { Session } from '../../../../services/session';
import { LocalWalletService } from '../../../blockchain/local-wallet.service';
import { BlockchainService } from '../../../blockchain/blockchain.service';
import { Web3WalletService } from '../../../blockchain/web3-wallet.service';
import { getBrowser } from '../../../../utils/browser';
import { FormToastService } from '../../../../common/services/form-toast.service';
import { WalletDashboardService } from '../dashboard.service';
import { Subscription } from 'rxjs';

enum Views {
  CreateAddress = 1,
  ProvideAddress,
  CurrentAddress,
}

@Component({
  selector: 'm-walletSettings--tokens',
  templateUrl: './settings-tokens.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WalletSettingsTokensComponent implements OnInit, OnDestroy {
  @Output() addressSetupComplete: EventEmitter<any> = new EventEmitter();
  wallet;
  inProgress: boolean = false;
  linkingMetamask: boolean = false;
  error: string;
  display: Views;
  generatedAccount: any;
  providedAddress: string = '';
  hasExternal: boolean = false;
  currentAddress: string = '';
  downloadingMetamask: boolean = false;
  form;
  minds = window.Minds;

  readonly Views = Views;

  private _externalTimer;

  constructor(
    protected client: Client,
    protected cd: ChangeDetectorRef,
    protected session: Session,
    protected router: Router,
    protected localWallet: LocalWalletService,
    protected blockchain: BlockchainService,
    protected web3Wallet: Web3WalletService,
    private formToastService: FormToastService,
    protected walletService: WalletDashboardService
  ) {}

  // TODOOJM add fx to reload whenever the current setting is updated

  ngOnInit() {
    this.load();
  }
  async load() {
    this.wallet = await this.walletService.getWallet();
    // Check if already has an address
    this.currentAddress =
      this.session.getLoggedInUser().eth_wallet || this.wallet.receiver.address;
    if (this.currentAddress) {
      this.display = Views.CurrentAddress;
      this.addressSetupComplete.emit();
    }

    this.form = new FormGroup({
      addressInput: new FormControl('', {
        validators: [Validators.required, this.validateAddressFormat],
      }),
    });

    this.checkExternal();
    this.detectChanges();
  }

  ngOnDestroy() {
    if (this._externalTimer) {
      clearInterval(this._externalTimer);
    }
  }

  async checkExternal() {
    this.hasExternal = !(await this.web3Wallet.isLocal());
    this.detectChanges();
  }

  async createAddress() {
    try {
      this.inProgress = true;
      this.detectChanges();

      this.generatedAccount = await this.localWallet.create(false);
      await this.blockchain.setWallet({
        address: this.generatedAccount.address,
      });
      this.currentAddress = this.generatedAccount.address;
    } catch (e) {
      console.error(e);
      this.formToastService.error(e);
    } finally {
      this.inProgress = false;
      this.detectChanges();
    }
  }

  async downloadPrivateKey() {
    try {
      this.inProgress = true;
      this.detectChanges();

      const { address, privateKey } = this.generatedAccount,
        filename = `pk_${address}.csv`,
        blob = new Blob([privateKey], { type: 'text/csv' });

      if (window.navigator.msSaveOrOpenBlob) {
        window.navigator.msSaveBlob(blob, filename);
        this.inProgress = false;
        this.addressSetupComplete.emit();
        this.detectChanges();
      } else {
        const link = window.document.createElement('a'),
          objectUrl = window.URL.createObjectURL(blob);

        link.href = objectUrl;
        link.download = filename;

        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        setTimeout(() => {
          URL.revokeObjectURL(objectUrl);
          this.generatedAccount = null;
          this.addressSetupComplete.emit();
          this.inProgress = false;
          this.detectChanges();
        }, 1000);
      }
      this.display = Views.CurrentAddress;
    } catch (e) {
      console.error(e);
      this.formToastService.error(e);
      this.inProgress = false;
    }
  }

  validateAddressFormat(control: AbstractControl) {
    if (control.value.length && !/^0x[a-fA-F0-9]{40}$/.test(control.value)) {
      return { format: true }; // true if invalid
    }
    return null; // null if valid
  }

  // isAddressFormatValid() {
  //   const isAddressValid =
  //     this.providedAddress && /^0x[a-fA-F0-9]{40}$/.test(this.providedAddress);
  //   if (!isAddressValid) {
  //     // this.formToastService.error('Invalid address format.');
  //   }
  //   return isAddressValid;
  // }

  async provideAddress() {
    if (this.form.invalid || this.inProgress) {
      return;
    }
    try {
      this.inProgress = true;
      this.detectChanges();

      await this.blockchain.setWallet({ address: this.addressInput.value });
      this.addressSetupComplete.emit();
    } catch (e) {
      this.formToastService.error(e);
      console.error(e);
    } finally {
      this.inProgress = false;
      this.linkingMetamask = false;
      this.currentAddress = this.addressInput.value;
      this.display = Views.CurrentAddress;
      this.detectChanges();
    }
  }

  downloadMetamask() {
    let browser: string = getBrowser();
    let url = '';
    switch (browser) {
      case 'chrome':
        url =
          'https://chrome.google.com/webstore/detail/metamask/nkbihfbeogaeaoehlefnkodbefgpgknn';
      case 'firefox':
        url = 'https://addons.mozilla.org/firefox/addon/ether-metamask/';
      case 'opera':
        url = 'https://addons.opera.com/extensions/details/metamask/';
      default:
        url = 'https://metamask.io';
    }
    window.open(url);
    this.downloadingMetamask = true;
  }

  async useExternal() {
    this.linkingMetamask = true;
    await this.web3Wallet.ready();
    this.detectExternal();

    this._externalTimer = setInterval(() => {
      this.detectExternal();
    }, 1000);
  }

  async detectExternal() {
    console.log(this.web3Wallet.getCurrentWallet(true));
    const address: string =
      (await this.web3Wallet.getCurrentWallet(true)) || '';

    if (this.providedAddress !== address) {
      this.providedAddress = address;
      this.detectChanges();

      if (this.providedAddress) {
        clearInterval(this._externalTimer);
        this.provideAddress();
      }
    }
  }

  detectChanges() {
    this.cd.markForCheck();
    this.cd.detectChanges();
  }
  get addressInput() {
    return this.form.get('addressInput');
  }
}
