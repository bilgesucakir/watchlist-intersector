package com.watchlistintersector.service;

import com.watchlistintersector.model.Film;

import java.util.Set;

/**
 * Outcome of scraping one user's watchlist. {@code accessible} is false when
 * the watchlist page returned no film tiles at all, which we treat as
 * "private or nonexistent" -- this can't be distinguished from a genuinely
 * empty public watchlist from the scraped HTML alone.
 */
public record WatchlistResult(String username, boolean accessible, Set<Film> films) {

    public static WatchlistResult inaccessible(String username) {
        return new WatchlistResult(username, false, Set.of());
    }

    public static WatchlistResult of(String username, Set<Film> films) {
        return new WatchlistResult(username, true, films);
    }
}
