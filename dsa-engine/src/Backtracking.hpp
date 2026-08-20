#ifndef BACKTRACKING_HPP
#define BACKTRACKING_HPP

#include <vector>
#include <algorithm>
#include "Table.hpp"

class TableCombiner {
private:
    std::vector<Table> available_tables;
    int target_capacity;
    std::vector<Table> best_combination;
    int best_capacity;
    size_t best_count;

    void backtrack(size_t index, int current_capacity, std::vector<Table>& current_combination) {
        // Pruning: if current capacity is already valid and worse than the best we found
        if (current_capacity >= target_capacity) {
            bool is_better = false;
            if (best_combination.empty()) {
                is_better = true;
            } else if (current_capacity < best_capacity) {
                is_better = true;
            } else if (current_capacity == best_capacity && current_combination.size() < best_count) {
                is_better = true;
            }

            if (is_better) {
                best_combination = current_combination;
                best_capacity = current_capacity;
                best_count = current_combination.size();
            }
            return; // No need to add more tables to this branch
        }

        // Pruning: if we've reached the end
        if (index >= available_tables.size()) {
            return;
        }

        // Pruning: if current capacity is already equal/worse than best capacity, stop
        if (!best_combination.empty() && current_capacity >= best_capacity) {
            return;
        }

        // Option 1: Include available_tables[index]
        current_combination.push_back(available_tables[index]);
        backtrack(index + 1, current_capacity + available_tables[index].capacity, current_combination);
        current_combination.pop_back(); // Backtrack

        // Option 2: Exclude available_tables[index]
        backtrack(index + 1, current_capacity, current_combination);
    }

public:
    TableCombiner(const std::vector<Table>& tables, int target)
        : available_tables(tables), target_capacity(target), best_capacity(999999), best_count(999999) {
        // Filter out occupied tables first (should only combine free tables)
        available_tables.erase(
            std::remove_if(available_tables.begin(), available_tables.end(),
                           [](const Table& t) { return t.is_occupied; }),
            available_tables.end()
        );
        // Sort available tables by capacity to speed up finding small/exact fit combinations first
        std::sort(available_tables.begin(), available_tables.end(),
                  [](const Table& a, const Table& b) { return a.capacity < b.capacity; });
    }

    std::vector<Table> solve() {
        best_combination.clear();
        best_capacity = 999999;
        best_count = 999999;

        std::vector<Table> current_combination;
        backtrack(0, 0, current_combination);

        return best_combination;
    }
};

#endif // BACKTRACKING_HPP
