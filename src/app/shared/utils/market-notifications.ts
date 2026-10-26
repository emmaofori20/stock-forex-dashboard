import { MarketLoadState } from '../../core/models/market-data';
import { NotificationService } from '../../core/services/notification.service';
// Called by page subscriptions; the API service has no notification/UI dependency.
export function notifyMarketFailure(
  notifications: NotificationService,
  state: MarketLoadState,
): void {
  if (state.status !== 'error' || !state.message) return;
  if (state.errorKind === 'rate-limit') notifications.warning(state.message, { durationMs: 10000 });
  else notifications.error(state.message);
}
