package com.firis.event;

import com.firis.event.controller.EventController;
import com.firis.event.service.AiEventCreated;
import com.firis.event.service.EventQueryService;
import com.firis.event.service.EventStreamService;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.request;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

class EventStreamServiceTest {
    @Test
    void sendsNewEventIdToAnActiveStream() throws Exception {
        var stream = new EventStreamService();
        var mvc = MockMvcBuilders.standaloneSetup(new EventController(mock(EventQueryService.class), stream)).build();

        var connection = mvc.perform(get("/api/events/stream").accept(MediaType.TEXT_EVENT_STREAM))
                .andExpect(status().isOk())
                .andExpect(request().asyncStarted())
                .andReturn();
        stream.onEventCreated(new AiEventCreated(42L));

        assertThat(connection.getResponse().getContentAsString())
                .contains("event:connected", "event:fire-event", "data:42");
    }
}
