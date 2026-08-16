package com.watchlistintersector.controller;

import com.watchlistintersector.controller.dto.ErrorResponseDto;
import com.watchlistintersector.controller.dto.UsernameCheckDto;
import com.watchlistintersector.service.LetterboxdScraperService;
import com.watchlistintersector.service.UsernameCheck;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class UserController {

    private final LetterboxdScraperService scraperService;

    public UserController(LetterboxdScraperService scraperService) {
        this.scraperService = scraperService;
    }

    @GetMapping("/api/users/{username}/exists")
    public ResponseEntity<?> exists(@PathVariable String username) {
        if (username.isBlank()) {
            return ResponseEntity.badRequest().body(new ErrorResponseDto("username is required."));
        }

        UsernameCheck check = scraperService.checkUsername(username);
        return ResponseEntity.ok(new UsernameCheckDto(check.userExists(), check.watchlistPublic(), check.avatarUrl()));
    }
}
