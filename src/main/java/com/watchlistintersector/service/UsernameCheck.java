package com.watchlistintersector.service;

/**
 * Result of checking a Letterboxd username without doing a full watchlist
 * scrape. {@code watchlistPublic} and {@code avatarUrl} are only meaningful
 * when {@code userExists} is true — a nonexistent user has neither.
 */
public record UsernameCheck(boolean userExists, boolean watchlistPublic, String avatarUrl) {

    public static UsernameCheck notFound() {
        return new UsernameCheck(false, false, null);
    }

    public static UsernameCheck existsWithWatchlist(boolean watchlistPublic, String avatarUrl) {
        return new UsernameCheck(true, watchlistPublic, avatarUrl);
    }
}
