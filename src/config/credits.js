// Replace only confirmed credits here; presentation is reusable for other endings.
export const CREDITS = {
  director: '[DIRECTOR]',
  actor: '[ACTOR]',
  creator: 'DANIEL MENDOZA',
  pixelsPerSecond: 38,
};

export function creditLines(config = CREDITS) {
  return [
    'RE NOCHE CERO', 'A FAN GAME TRIBUTE', '',
    'Based on the Resident Evil universe', 'Resident Evil © CAPCOM', '',
    'Inspired by:', 'Resident Evil: Noche Cero', '',
    'Original film director:', config.director, '',
    'Bryan portrayed by:', config.actor, '',
    'Fan game created by:', config.creator, '',
    'Programming / Game Design:', config.creator, '',
    'Created as a non-commercial fan tribute.', '', 'Thank you for playing.',
  ];
}
