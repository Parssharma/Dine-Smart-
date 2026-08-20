#ifndef JSONPARSER_HPP
#define JSONPARSER_HPP

#include <string>
#include <vector>
#include <algorithm>
#include "Table.hpp"
#include "WaitlistEntry.hpp"

class JsonParser {
public:
    static std::string extractString(const std::string& json, const std::string& key) {
        size_t keyPos = json.find("\"" + key + "\"");
        if (keyPos == std::string::npos) return "";
        
        size_t colonPos = json.find(":", keyPos);
        if (colonPos == std::string::npos) return "";
        
        size_t openQuote = json.find("\"", colonPos);
        if (openQuote == std::string::npos) return "";
        
        size_t closeQuote = json.find("\"", openQuote + 1);
        if (closeQuote == std::string::npos) return "";
        
        return json.substr(openQuote + 1, closeQuote - openQuote - 1);
    }

    static int extractInt(const std::string& json, const std::string& key) {
        size_t keyPos = json.find("\"" + key + "\"");
        if (keyPos == std::string::npos) return 0;
        
        size_t colonPos = json.find(":", keyPos);
        if (colonPos == std::string::npos) return 0;
        
        size_t i = colonPos + 1;
        while (i < json.size() && (json[i] == ' ' || json[i] == '\t')) i++;
        
        std::string valStr = "";
        while (i < json.size() && json[i] != ',' && json[i] != '}' && json[i] != ']') {
            valStr += json[i];
            i++;
        }
        try {
            return std::stoi(valStr);
        } catch (...) {
            return 0;
        }
    }

    static double extractDouble(const std::string& json, const std::string& key) {
        size_t keyPos = json.find("\"" + key + "\"");
        if (keyPos == std::string::npos) return 0.0;
        
        size_t colonPos = json.find(":", keyPos);
        if (colonPos == std::string::npos) return 0.0;
        
        size_t i = colonPos + 1;
        while (i < json.size() && (json[i] == ' ' || json[i] == '\t')) i++;
        
        std::string valStr = "";
        while (i < json.size() && json[i] != ',' && json[i] != '}' && json[i] != ']') {
            valStr += json[i];
            i++;
        }
        try {
            return std::stod(valStr);
        } catch (...) {
            return 0.0;
        }
    }

    static bool extractBool(const std::string& json, const std::string& key) {
        size_t keyPos = json.find("\"" + key + "\"");
        if (keyPos == std::string::npos) return false;
        
        size_t colonPos = json.find(":", keyPos);
        if (colonPos == std::string::npos) return false;
        
        size_t i = colonPos + 1;
        while (i < json.size() && (json[i] == ' ' || json[i] == '\t')) i++;
        
        std::string valStr = "";
        while (i < json.size() && json[i] != ',' && json[i] != '}' && json[i] != ']') {
            valStr += json[i];
            i++;
        }
        return (valStr.find("true") != std::string::npos);
    }

    static std::vector<std::string> splitJsonArray(const std::string& jsonArray) {
        std::vector<std::string> items;
        size_t start = jsonArray.find("[");
        if (start == std::string::npos) return items;
        
        size_t end = jsonArray.find_last_of("]");
        if (end == std::string::npos || end <= start) return items;
        
        std::string content = jsonArray.substr(start + 1, end - start - 1);
        
        int braceCount = 0;
        std::string currentItem = "";
        bool inQuote = false;
        
        for (size_t i = 0; i < content.size(); ++i) {
            char c = content[i];
            if (c == '"' && (i == 0 || content[i-1] != '\\')) {
                inQuote = !inQuote;
            }
            
            if (!inQuote) {
                if (c == '{') {
                    braceCount++;
                } else if (c == '}') {
                    braceCount--;
                }
            }
            
            currentItem += c;
            
            if (braceCount == 0 && !inQuote && (c == ',' || i == content.size() - 1)) {
                if (!currentItem.empty() && currentItem.back() == ',') {
                    currentItem.pop_back();
                }
                size_t s = currentItem.find_first_not_of(" \t\r\n");
                size_t e = currentItem.find_last_not_of(" \t\r\n");
                if (s != std::string::npos && e != std::string::npos) {
                    std::string item = currentItem.substr(s, e - s + 1);
                    if (!item.empty() && item != ",") {
                        items.push_back(item);
                    }
                }
                currentItem = "";
            }
        }
        return items;
    }

    static Table parseTable(const std::string& itemJson) {
        return Table(
            extractString(itemJson, "id"),
            extractInt(itemJson, "capacity"),
            extractString(itemJson, "location"),
            extractBool(itemJson, "is_occupied"),
            extractDouble(itemJson, "rating")
        );
    }

    static WaitlistEntry parseWaitlistEntry(const std::string& itemJson) {
        return WaitlistEntry(
            extractString(itemJson, "id"),
            extractString(itemJson, "customerName"),
            extractInt(itemJson, "partySize"),
            extractString(itemJson, "contact")
        );
    }
};

#endif // JSONPARSER_HPP
