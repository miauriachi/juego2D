export class GameStats {
  constructor() {
    this.startedAt = performance.now();
    this.saves = 0;
    this.healingItemsUsed = 0;
    this.finishedSnapshot = null;
  }

  recordSave() { this.saves += 1; }
  recordHealingUse() { this.healingItemsUsed += 1; }

  finish() {
    if (this.finishedSnapshot) return this.finishedSnapshot;
    const elapsedMs = Math.max(0, performance.now() - this.startedAt);
    const totalSeconds = Math.floor(elapsedMs / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;

    let rank = 'C';
    if (minutes < 30 && this.saves <= 3 && this.healingItemsUsed <= 2) rank = 'S';
    else if (minutes < 45 && this.saves <= 6 && this.healingItemsUsed <= 4) rank = 'A';
    else if (minutes < 60 && this.healingItemsUsed <= 8) rank = 'B';

    this.finishedSnapshot = {
      elapsedMs,
      totalSeconds,
      timeText: `${String(Math.floor(totalSeconds / 3600)).padStart(2, '0')}:${String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`,
      saves: this.saves,
      healingItemsUsed: this.healingItemsUsed,
      rank,
    };
    return this.finishedSnapshot;
  }
}
