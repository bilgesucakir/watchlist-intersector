package com.watchlistintersector.service;

/**
 * Result of checking a Letterboxd username without doing a full watchlist
 * scrape. {@code watchlistPublic} is only meaningful when {@code userExists}
 * is true — a nonexistent user has no watchlist to speak of.
 */
public record UsernameCheck(boolean userExists, boolean watchlistPublic) {

    public static UsernameCheck notFound() {
        return new UsernameCheck(false, false);
    }

    public static UsernameCheck existsWithWatchlist(boolean watchlistPublic) {
        return new UsernameCheck(true, watchlistPublic);
    }
}
