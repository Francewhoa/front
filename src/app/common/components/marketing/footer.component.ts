import { ChangeDetectionStrategy, Component } from '@angular/core';
import { ConfigsService } from '../../services/configs.service';

@Component({
  selector: 'm-marketing__footer',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: 'footer.component.html',
})
export class MarketingFooterComponent {
  readonly year: number = new Date().getFullYear();

  readonly cdnAssetsUrl: string;

  constructor(private configs: ConfigsService) {
    this.cdnAssetsUrl = configs.get('cdn_assets_url');
  }
}
