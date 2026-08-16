package com.watchlistintersector.service;

import com.watchlistintersector.model.Film;
import org.springframework.stereotype.Service;

import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Service
public class WatchlistIntersectionService {

    /**
     * Films present on both watchlists, sorted alphabetically by title.
     * Title/year come from result1's copy of the film when both users have
     * it (the two should always agree, since it's the same Letterboxd page).
     */
    public List<Film> intersect(WatchlistResult result1, WatchlistResult result2) {
        Map<String, Film> filmsBySlug = result1.films().stream()
                .collect(Collectors.toMap(Film::slug, film -> film, (a, b) -> a));

        return result2.films().stream()
                .filter(film -> filmsBySlug.containsKey(film.slug()))
                .map(film -> filmsBySlug.get(film.slug()))
                .sorted(Comparator.comparing(Film::title, String.CASE_INSENSITIVE_ORDER))
                .toList();
    }
}
