package com.watchlistintersector.controller;

import com.watchlistintersector.controller.dto.ErrorResponseDto;
import com.watchlistintersector.controller.dto.FilmMatchDto;
import com.watchlistintersector.model.Film;
import com.watchlistintersector.service.LetterboxdScraperService;
import com.watchlistintersector.service.WatchlistResult;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.concurrent.CompletableFuture;
import java.util.stream.Collectors;

@RestController
public class IntersectController {

    private static final String FILM_URL_TEMPLATE = "https://letterboxd.com/film/%s/";

    private final LetterboxdScraperService scraperService;

    public IntersectController(LetterboxdScraperService scraperService) {
        this.scraperService = scraperService;
    }

    @GetMapping("/api/intersect")
    public ResponseEntity<?> intersect(@RequestParam String user1, @RequestParam String user2) {
        if (user1.isBlank() || user2.isBlank()) {
            return ResponseEntity.badRequest().body(new ErrorResponseDto("Both user1 and user2 are required."));
        }

        CompletableFuture<WatchlistResult> future1 =
                CompletableFuture.supplyAsync(() -> scraperService.fetchWatchlist(user1));
        CompletableFuture<WatchlistResult> future2 =
                CompletableFuture.supplyAsync(() -> scraperService.fetchWatchlist(user2));

        WatchlistResult result1 = future1.join();
        WatchlistResult result2 = future2.join();

        List<String> inaccessible = List.of(result1, result2).stream()
                .filter(result -> !result.accessible())
                .map(WatchlistResult::username)
                .toList();

        if (!inaccessible.isEmpty()) {
            String error = "Watchlist inaccessible (private or nonexistent) for: " + String.join(", ", inaccessible);
            return ResponseEntity.badRequest().body(new ErrorResponseDto(error));
        }

        List<FilmMatchDto> matches = intersect(result1, result2);
        return ResponseEntity.ok(matches);
    }

    private List<FilmMatchDto> intersect(WatchlistResult result1, WatchlistResult result2) {
        Map<String, String> titlesBySlug = result1.films().stream()
                .collect(Collectors.toMap(Film::slug, Film::title, (a, b) -> a));

        return result2.films().stream()
                .filter(film -> titlesBySlug.containsKey(film.slug()))
                .map(film -> new FilmMatchDto(titlesBySlug.get(film.slug()), FILM_URL_TEMPLATE.formatted(film.slug())))
                .sorted(Comparator.comparing(FilmMatchDto::title, String.CASE_INSENSITIVE_ORDER))
                .toList();
    }
}
