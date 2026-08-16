package com.watchlistintersector.model;

/**
 * A film as it appears on a Letterboxd watchlist. The slug is the stable
 * identifier used for matching between two users' watchlists.
 */
public record Film(String slug, String title) {
}
