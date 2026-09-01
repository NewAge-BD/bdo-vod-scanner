import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import type { BdoEvent } from '../../domain/events';
import { EventChatText } from './EventChatText';

const event: BdoEvent = {
  id: 'chat-event',
  lineNumber: 1,
  rawLine: '[20:04:00] Vinny killed Haroshu from Version (HaroshuCharacter, VinnyCharacter)',
  clockTime: '20:04:00',
  dayOffset: 0,
  sessionTimeSeconds: 72_240,
  verb: 'killed',
  familyA: 'Vinny',
  familyB: 'Haroshu',
  guildB: 'Version',
  characterA: 'VinnyCharacter',
  characterB: 'HaroshuCharacter',
};

describe('EventChatText', () => {
  it('exposes BDO-inspired semantic color roles without hiding the event text', () => {
    const { container } = render(<EventChatText detailed event={event} />);

    expect(screen.getByText('Vinny')).toHaveClass('event-chat-text__family');
    expect(screen.getByText('killed')).toHaveClass(
      'event-chat-text__verb',
      'event-chat-text__verb--kill',
    );
    expect(screen.getByText('Version')).toHaveClass('event-chat-text__guild');
    expect(container).toHaveTextContent(
      'Vinny killed Haroshu from Version (HaroshuCharacter, VinnyCharacter)',
    );
  });

  it('uses the death color role for died-to events', () => {
    render(<EventChatText event={{ ...event, verb: 'diedTo' }} />);

    expect(screen.getByText('was slain by')).toHaveClass('event-chat-text__verb--death');
  });
});
