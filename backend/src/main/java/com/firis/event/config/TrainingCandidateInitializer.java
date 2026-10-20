package com.firis.event.config;

import com.firis.event.repository.EventReviewRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.stereotype.Component;

@Component
public class TrainingCandidateInitializer implements ApplicationRunner {
    private static final Logger log = LoggerFactory.getLogger(TrainingCandidateInitializer.class);
    private final EventReviewRepository reviews;

    public TrainingCandidateInitializer(EventReviewRepository reviews) { this.reviews = reviews; }

    @Override
    public void run(ApplicationArguments args) {
        int count = reviews.includeExistingFalsePositives();
        log.info("Existing false-positive reviews included as training candidates: {}", count);
    }
}