export const MAX_CONSECUTIVE_DENIALS = 3;
export const MAX_TOTAL_DENIALS = 20;

export class DenialTracker {
  private consecutive = 0;
  private total = 0;

  get consecutiveDenials(): number {
    return this.consecutive;
  }

  get totalDenials(): number {
    return this.total;
  }

  recordDenial(): boolean {
    this.consecutive++;
    this.total++;
    return this.isLimitExceeded();
  }

  recordAllow(): void {
    this.consecutive = 0;
  }

  reset(): void {
    this.consecutive = 0;
    this.total = 0;
  }

  isLimitExceeded(): boolean {
    return this.consecutive >= MAX_CONSECUTIVE_DENIALS || this.total >= MAX_TOTAL_DENIALS;
  }
}
