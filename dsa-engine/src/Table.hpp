#ifndef TABLE_HPP
#define TABLE_HPP

#include <string>

struct Table {
    std::string id;
    int capacity;
    std::string location; // "Window", "Center", "Outdoor", etc.
    bool is_occupied;
    double rating; // e.g., 1.0 to 5.0, used for priority ranking

    Table() : id(""), capacity(0), location(""), is_occupied(false), rating(0.0) {}

    Table(std::string tableId, int cap, std::string loc, bool occupied, double rate)
        : id(tableId), capacity(cap), location(loc), is_occupied(occupied), rating(rate) {}
};

#endif // TABLE_HPP
