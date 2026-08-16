package com.watchlistintersector.controller;

import com.watchlistintersector.controller.dto.ErrorResponseDto;
import com.watchlistintersector.controller.dto.FilmMatchDto;
import com.watchlistintersector.model.Film;
import com.watchlistintersector.service.LetterboxdScraperService;
import com.watchlistintersector.service.TmdbPosterService;
import com.watchlistintersector.service.WatchlistIntersectionService;
import com.watchlistintersector.service.WatchlistResult;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Optional;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.Executor;
import java.util.concurrent.Executors;
import java.util.concurrent.ThreadLocalRandom;

@RestController
public class IntersectController {

    private static final String FILM_URL_TEMPLATE = "https://letterboxd.com/film/%s/";

    private final LetterboxdScraperService scraperService;
    private final WatchlistIntersectionService intersectionService;
    private final TmdbPosterService posterService;

    /**
     * Dedicated executor so the two watchlist fetches -- and, further down,
     * the per-film poster lookups -- run truly in parallel. ForkJoinPool
     * .commonPool() sizes itself off availableProcessors(), which on a
     * constrained host (e.g. a fractional-vCPU container) can report 1 and
     * silently serialize everything instead of running it concurrently.
     */
    private final Executor ioExecutor = Executors.newVirtualThreadPerTaskExecutor();

    public IntersectController(
            LetterboxdScraperService scraperService,
            WatchlistIntersectionService intersectionService,
            TmdbPosterService posterService) {
        this.scraperService = scraperService;
        this.intersectionService = intersectionService;
        this.posterService = posterService;
    }

    @GetMapping("/api/intersect")
    public ResponseEntity<?> intersect(
            @RequestParam String user1,
            @RequestParam String user2,
            @RequestParam(defaultValue = "false") boolean random) {
        if (user1.isBlank() || user2.isBlank()) {
            return ResponseEntity.badRequest().body(new ErrorResponseDto("Both user1 and user2 are required."));
        }

        CompletableFuture<WatchlistResult> future1 =
                CompletableFuture.supplyAsync(() -> scraperService.fetchWatchlist(user1), ioExecutor);
        CompletableFuture<WatchlistResult> future2 =
                CompletableFuture.supplyAsync(() -> scraperService.fetchWatchlist(user2), ioExecutor);

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

        List<Film> matchedFilms = intersectionService.intersect(result1, result2);

        // In random mode, only the one film we're actually returning needs a
        // poster lookup -- no point spending TMDB calls on films we're not
        // going to show.
        List<Film> filmsToReturn = random ? pickOneRandomFilm(matchedFilms).map(List::of).orElseGet(List::of) : matchedFilms;

        List<FilmMatchDto> matches = filmsToReturn.stream()
                .map(film -> CompletableFuture.supplyAsync(() -> toDto(film), ioExecutor))
                .toList()
                .stream()
                .map(CompletableFuture::join)
                .toList();

        return ResponseEntity.ok(matches);
    }

    private Optional<Film> pickOneRandomFilm(List<Film> films) {
        if (films.isEmpty()) {
            return Optional.empty();
        }
        return Optional.of(films.get(ThreadLocalRandom.current().nextInt(films.size())));
    }

    private FilmMatchDto toDto(Film film) {
        String posterUrl = posterService.findPosterUrl(film.title(), film.year());
        return new FilmMatchDto(film.title(), FILM_URL_TEMPLATE.formatted(film.slug()), film.year(), posterUrl);
    }
}
