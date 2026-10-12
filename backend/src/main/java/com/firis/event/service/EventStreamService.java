package com.firis.event.service;

import java.io.IOException;
import java.util.concurrent.CopyOnWriteArrayList;
import org.springframework.stereotype.Service;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

@Service
public class EventStreamService {
    private final CopyOnWriteArrayList<SseEmitter> subscribers = new CopyOnWriteArrayList<>();

    public SseEmitter subscribe() {
        var emitter = new SseEmitter(0L);
        subscribers.add(emitter);
        emitter.onCompletion(() -> subscribers.remove(emitter));
        emitter.onTimeout(() -> subscribers.remove(emitter));
        emitter.onError(error -> subscribers.remove(emitter));
        try {
            emitter.send(SseEmitter.event().name("connected").data("ok"));
        } catch (IOException | IllegalStateException error) {
            subscribers.remove(emitter);
            emitter.completeWithError(error);
        }
        return emitter;
    }

    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void onEventCreated(AiEventCreated created) {
        for (var emitter : subscribers) {
            try {
                emitter.send(SseEmitter.event().name("fire-event").data(created.eventId()));
            } catch (IOException | IllegalStateException error) {
                subscribers.remove(emitter);
                emitter.completeWithError(error);
            }
        }
    }
}
