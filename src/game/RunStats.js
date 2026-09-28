export class RunStats {
  constructor() {
    this.startedAt = performance.now();
    this.finishedAt = null;
    this.saves = 0;
    this.healingItemsUsed = 0;
  }

  recordSave() {
    this.saves += 1;
  }

  recordHealingItemUse() {
    this.healingItemsUsed += 1;
  }

  finish() {
    if (this.finishedAt == null) this.finishedAt = performance.now();
    const elapsedSeconds = Math.max(0, (this.finishedAt - this.startedAt) / 1000);
    return {
      elapsedSeconds,
      saves: this.saves,
      healingItemsUsed: this.healingItemsUsed,
      rank: this.calculateRank(elapsedSeconds),
    };
  }

  calculateRank(elapsedSeconds) {
    const minutes = elapsedSeconds / 60;
    if (minutes <= 25 && this.saves <= 1 && this.healingItemsUsed <= 1) return 'S';
    if (minutes <= 40 && this.saves <= 3 && this.healingItemsUsed <= 3) return 'A';
    if (minutes <= 60 && this.saves <= 6 && this.healingItemsUsed <= 6) return 'B';
    if (minutes <= 90) return 'C';
    return 'D';
  }
}
