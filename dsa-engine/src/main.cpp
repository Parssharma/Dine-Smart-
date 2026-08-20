#include <iostream>
#include <string>
#include <vector>
#include "Table.hpp"
#include "WaitlistEntry.hpp"
#include "HashMap.hpp"
#include "PriorityQueue.hpp"
#include "Queue.hpp"
#include "Backtracking.hpp"
#include "JsonParser.hpp"

// Structured recommendation type
struct ScoredTable {
    double score;
    Table table;

    bool operator>(const ScoredTable& other) const {
        return score > other.score;
    }
    bool operator<(const ScoredTable& other) const {
        return score < other.score;
    }
};

// JSON Escape helper
std::string escapeJsonString(const std::string& input) {
    std::string output = "";
    for (char c : input) {
        if (c == '"') output += "\\\"";
        else if (c == '\\') output += "\\\\";
        else if (c == '\b') output += "\\b";
        else if (c == '\f') output += "\\f";
        else if (c == '\n') output += "\\n";
        else if (c == '\r') output += "\\r";
        else if (c == '\t') output += "\\t";
        else output += c;
    }
    return output;
}

int main() {
    // Read JSON payload from stdin
    std::string inputLine;
    std::string jsonPayload = "";
    while (std::getline(std::cin, inputLine)) {
        jsonPayload += inputLine;
    }

    if (jsonPayload.empty()) {
        std::cout << "{\"status\":\"error\",\"message\":\"Empty input\"}" << std::endl;
        return 0;
    }

    std::string action = JsonParser::extractString(jsonPayload, "action");

    if (action == "lookup") {
        std::string tablesJson = JsonParser::extractString(jsonPayload, "tables");
        std::string lookupId = JsonParser::extractString(jsonPayload, "lookupId");

        // Parse tables into vector
        std::vector<std::string> tableObjects = JsonParser::splitJsonArray(jsonPayload); 
        // Note: splitJsonArray on jsonPayload will find the tables array if we search for "tables" key or if we extract tables content.
        // Let's locate the substring of "tables" array specifically to parse it.
        size_t tablesKeyPos = jsonPayload.find("\"tables\"");
        std::vector<Table> tables;
        if (tablesKeyPos != std::string::npos) {
            size_t arrayStart = jsonPayload.find("[", tablesKeyPos);
            size_t arrayEnd = jsonPayload.find("]", arrayStart);
            if (arrayStart != std::string::npos && arrayEnd != std::string::npos) {
                std::string arraySub = jsonPayload.substr(arrayStart, arrayEnd - arrayStart + 1);
                std::vector<std::string> tableStrings = JsonParser::splitJsonArray(arraySub);
                for (const auto& tStr : tableStrings) {
                    tables.push_back(JsonParser::parseTable(tStr));
                }
            }
        }

        // Put in HashMap
        HashMap<Table> tableMap;
        for (const auto& table : tables) {
            tableMap.put(table.id, table);
        }

        Table* foundTable = tableMap.get(lookupId);
        if (foundTable != nullptr) {
            std::cout << "{\"status\":\"success\",\"table\":{"
                      << "\"id\":\"" << escapeJsonString(foundTable->id) << "\","
                      << "\"capacity\":" << foundTable->capacity << ","
                      << "\"location\":\"" << escapeJsonString(foundTable->location) << "\","
                      << "\"is_occupied\":" << (foundTable->is_occupied ? "true" : "false") << ","
                      << "\"rating\":" << foundTable->rating
                      << "}}" << std::endl;
        } else {
            std::cout << "{\"status\":\"error\",\"message\":\"Table not found\"}" << std::endl;
        }

    } else if (action == "recommend") {
        int partySize = JsonParser::extractInt(jsonPayload, "partySize");
        std::string preference = JsonParser::extractString(jsonPayload, "preference");

        size_t tablesKeyPos = jsonPayload.find("\"tables\"");
        std::vector<Table> tables;
        if (tablesKeyPos != std::string::npos) {
            size_t arrayStart = jsonPayload.find("[", tablesKeyPos);
            size_t arrayEnd = jsonPayload.find("]", arrayStart);
            if (arrayStart != std::string::npos && arrayEnd != std::string::npos) {
                std::string arraySub = jsonPayload.substr(arrayStart, arrayEnd - arrayStart + 1);
                std::vector<std::string> tableStrings = JsonParser::splitJsonArray(arraySub);
                for (const auto& tStr : tableStrings) {
                    tables.push_back(JsonParser::parseTable(tStr));
                }
            }
        }

        PriorityQueue<ScoredTable> pq;

        for (const auto& table : tables) {
            // Must be unoccupied and satisfy capacity
            if (!table.is_occupied && table.capacity >= partySize) {
                // Score metric
                double capacityFit = 10.0 / (1.0 + (table.capacity - partySize)); // closer capacity = higher score
                double ratingScore = table.rating; // standard customer rating weight
                double locationBonus = (table.location == preference) ? 5.0 : 0.0; // location match bonus
                
                double totalScore = capacityFit + ratingScore + locationBonus;
                
                ScoredTable st = { totalScore, table };
                pq.push(st);
            }
        }

        // Pop up to 3 recommendations
        std::vector<ScoredTable> recommendations;
        int count = 0;
        while (!pq.isEmpty() && count < 3) {
            recommendations.push_back(pq.top());
            pq.pop();
            count++;
        }

        // Build output JSON
        std::cout << "{\"status\":\"success\",\"recommendations\":[";
        for (size_t i = 0; i < recommendations.size(); ++i) {
            const auto& st = recommendations[i];
            std::cout << "{"
                      << "\"id\":\"" << escapeJsonString(st.table.id) << "\","
                      << "\"capacity\":" << st.table.capacity << ","
                      << "\"location\":\"" << escapeJsonString(st.table.location) << "\","
                      << "\"rating\":" << st.table.rating << ","
                      << "\"score\":" << st.score
                      << "}";
            if (i < recommendations.size() - 1) std::cout << ",";
        }
        std::cout << "]}" << std::endl;

    } else if (action == "waitlist") {
        std::string actionType = JsonParser::extractString(jsonPayload, "actionType");
        
        // Find "waitlist" array
        size_t waitlistKeyPos = jsonPayload.find("\"waitlist\"");
        std::vector<WaitlistEntry> waitlistEntries;
        if (waitlistKeyPos != std::string::npos) {
            size_t arrayStart = jsonPayload.find("[", waitlistKeyPos);
            size_t arrayEnd = jsonPayload.find("]", arrayStart);
            if (arrayStart != std::string::npos && arrayEnd != std::string::npos) {
                std::string arraySub = jsonPayload.substr(arrayStart, arrayEnd - arrayStart + 1);
                std::vector<std::string> waitlistStrings = JsonParser::splitJsonArray(arraySub);
                for (const auto& wStr : waitlistStrings) {
                    waitlistEntries.push_back(JsonParser::parseWaitlistEntry(wStr));
                }
            }
        }

        // Fill custom FIFO Queue
        Queue<WaitlistEntry> waitlistQueue;
        for (const auto& entry : waitlistEntries) {
            waitlistQueue.enqueue(entry);
        }

        if (actionType == "join") {
            // Parse new entry
            size_t newEntryKeyPos = jsonPayload.find("\"newEntry\"");
            if (newEntryKeyPos != std::string::npos) {
                size_t objStart = jsonPayload.find("{", newEntryKeyPos);
                size_t objEnd = jsonPayload.find("}", objStart);
                if (objStart != std::string::npos && objEnd != std::string::npos) {
                    std::string newEntryStr = jsonPayload.substr(objStart, objEnd - objStart + 1);
                    WaitlistEntry newEntry = JsonParser::parseWaitlistEntry(newEntryStr);
                    waitlistQueue.enqueue(newEntry);
                }
            }

            int position = waitlistQueue.size();
            std::vector<WaitlistEntry> updatedList = waitlistQueue.toVector();

            // Print output JSON
            std::cout << "{\"status\":\"success\",\"position\":" << position << ",\"waitlist\":[";
            for (size_t i = 0; i < updatedList.size(); ++i) {
                const auto& entry = updatedList[i];
                std::cout << "{"
                          << "\"id\":\"" << escapeJsonString(entry.id) << "\","
                          << "\"customerName\":\"" << escapeJsonString(entry.customerName) << "\","
                          << "\"partySize\":" << entry.partySize << ","
                          << "\"contact\":\"" << escapeJsonString(entry.contact) << "\""
                          << "}";
                if (i < updatedList.size() - 1) std::cout << ",";
            }
            std::cout << "]}" << std::endl;

        } else if (actionType == "position") {
            std::string customerId = JsonParser::extractString(jsonPayload, "customerId");
            std::vector<WaitlistEntry> list = waitlistQueue.toVector();
            int position = -1;
            for (size_t i = 0; i < list.size(); ++i) {
                if (list[i].id == customerId) {
                    position = static_cast<int>(i) + 1; // 1-indexed queue position
                    break;
                }
            }
            std::cout << "{\"status\":\"success\",\"position\":" << position << "}" << std::endl;
        } else {
            std::cout << "{\"status\":\"error\",\"message\":\"Invalid waitlist actionType\"}" << std::endl;
        }

    } else if (action == "combine") {
        int partySize = JsonParser::extractInt(jsonPayload, "partySize");

        size_t tablesKeyPos = jsonPayload.find("\"tables\"");
        std::vector<Table> tables;
        if (tablesKeyPos != std::string::npos) {
            size_t arrayStart = jsonPayload.find("[", tablesKeyPos);
            size_t arrayEnd = jsonPayload.find("]", arrayStart);
            if (arrayStart != std::string::npos && arrayEnd != std::string::npos) {
                std::string arraySub = jsonPayload.substr(arrayStart, arrayEnd - arrayStart + 1);
                std::vector<std::string> tableStrings = JsonParser::splitJsonArray(arraySub);
                for (const auto& tStr : tableStrings) {
                    tables.push_back(JsonParser::parseTable(tStr));
                }
            }
        }

        // Solve combination using Backtracking
        TableCombiner combiner(tables, partySize);
        std::vector<Table> combination = combiner.solve();

        int totalCapacity = 0;
        std::cout << "{\"status\":\"success\",\"combination\":[";
        for (size_t i = 0; i < combination.size(); ++i) {
            totalCapacity += combination[i].capacity;
            std::cout << "{"
                      << "\"id\":\"" << escapeJsonString(combination[i].id) << "\","
                      << "\"capacity\":" << combination[i].capacity << ","
                      << "\"location\":\"" << escapeJsonString(combination[i].location) << "\""
                      << "}";
            if (i < combination.size() - 1) std::cout << ",";
        }
        std::cout << "],\"totalCapacity\":" << totalCapacity << "}" << std::endl;

    } else {
        std::cout << "{\"status\":\"error\",\"message\":\"Unknown action\"}" << std::endl;
    }

    return 0;
}
