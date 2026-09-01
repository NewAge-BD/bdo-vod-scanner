import type { BdoEvent } from '../../domain/events';

interface EventChatTextProps {
  readonly detailed?: boolean;
  readonly event: BdoEvent;
}

export function EventChatText({ detailed = false, event }: EventChatTextProps) {
  return (
    <span className="event-chat-text">
      <span className="event-chat-text__family">{event.familyA}</span>{' '}
      <span
        className={`event-chat-text__verb event-chat-text__verb--${event.verb === 'killed' ? 'kill' : 'death'}`}
      >
        {event.verb === 'killed' ? 'killed' : 'was slain by'}
      </span>{' '}
      <span className="event-chat-text__family">{event.familyB}</span>
      {detailed && (
        <>
          <span className="event-chat-text__connector"> from </span>
          <span className="event-chat-text__guild">{event.guildB}</span>
          <span className="event-chat-text__details">
            {' '}
            ({event.characterB}, {event.characterA})
          </span>
        </>
      )}
    </span>
  );
}
