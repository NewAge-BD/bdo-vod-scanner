import type { BdoEvent } from '../../domain/events';

interface EventChatTextProps {
  readonly detailed?: boolean;
  readonly event: BdoEvent;
}

export function EventChatText({ detailed = false, event }: EventChatTextProps) {
  return (
    <span className="event-chat-text">
      <span className="event-chat-text__family">{event.familyA}</span>{' '}
      {event.verb === 'killed' ? (
        <span className="event-chat-text__verb event-chat-text__verb--kill">killed</span>
      ) : (
        <>
          <span className="event-chat-text__death-connector">was </span>
          <span className="event-chat-text__verb event-chat-text__verb--death">slain</span>
          <span className="event-chat-text__death-connector"> by</span>
        </>
      )}{' '}
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
