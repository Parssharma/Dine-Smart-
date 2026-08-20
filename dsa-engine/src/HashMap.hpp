#ifndef HASHMAP_HPP
#define HASHMAP_HPP

#include <string>
#include <vector>

template <typename V>
class HashMap {
private:
    struct Node {
        std::string key;
        V value;
        Node* next;
        Node(const std::string& k, const V& v) : key(k), value(v), next(nullptr) {}
    };

    Node** buckets;
    int capacity;
    int num_elements;
    double max_load_factor;

    size_t getHash(const std::string& key) const {
        size_t hash = 5381; // djb2 initial value
        for (char c : key) {
            hash = ((hash << 5) + hash) + c; /* hash * 33 + c */
        }
        return hash % capacity;
    }

    void rehash() {
        int old_capacity = capacity;
        Node** old_buckets = buckets;

        capacity = capacity * 2;
        buckets = new Node*[capacity]();
        num_elements = 0;

        for (int i = 0; i < old_capacity; ++i) {
            Node* curr = old_buckets[i];
            while (curr != nullptr) {
                put(curr->key, curr->value);
                Node* temp = curr;
                curr = curr->next;
                delete temp;
            }
        }
        delete[] old_buckets;
    }

public:
    HashMap(int initial_capacity = 16, double load_factor = 0.75) 
        : capacity(initial_capacity), num_elements(0), max_load_factor(load_factor) {
        buckets = new Node*[capacity]();
    }

    ~HashMap() {
        clear();
        delete[] buckets;
    }

    void clear() {
        for (int i = 0; i < capacity; ++i) {
            Node* curr = buckets[i];
            while (curr != nullptr) {
                Node* temp = curr;
                curr = curr->next;
                delete temp;
            }
            buckets[i] = nullptr;
        }
        num_elements = 0;
    }

    int size() const {
        return num_elements;
    }

    bool isEmpty() const {
        return num_elements == 0;
    }

    void put(const std::string& key, const V& value) {
        if ((double)num_elements / capacity >= max_load_factor) {
            rehash();
        }

        size_t index = getHash(key);
        Node* curr = buckets[index];
        while (curr != nullptr) {
            if (curr->key == key) {
                curr->value = value;
                return;
            }
            curr = curr->next;
        }

        Node* new_node = new Node(key, value);
        new_node->next = buckets[index];
        buckets[index] = new_node;
        num_elements++;
    }

    V* get(const std::string& key) {
        size_t index = getHash(key);
        Node* curr = buckets[index];
        while (curr != nullptr) {
            if (curr->key == key) {
                return &(curr->value);
            }
            curr = curr->next;
        }
        return nullptr;
    }

    const V* get(const std::string& key) const {
        size_t index = getHash(key);
        Node* curr = buckets[index];
        while (curr != nullptr) {
            if (curr->key == key) {
                return &(curr->value);
            }
            curr = curr->next;
        }
        return nullptr;
    }

    bool remove(const std::string& key) {
        size_t index = getHash(key);
        Node* curr = buckets[index];
        Node* prev = nullptr;

        while (curr != nullptr) {
            if (curr->key == key) {
                if (prev == nullptr) {
                    buckets[index] = curr->next;
                } else {
                    prev->next = curr->next;
                }
                delete curr;
                num_elements--;
                return true;
            }
            prev = curr;
            curr = curr->next;
        }
        return false;
    }

    std::vector<V> getAllValues() const {
        std::vector<V> values;
        values.reserve(num_elements);
        for (int i = 0; i < capacity; ++i) {
            Node* curr = buckets[i];
            while (curr != nullptr) {
                values.push_back(curr->value);
                curr = curr->next;
            }
        }
        return values;
    }

    std::vector<std::string> getAllKeys() const {
        std::vector<std::string> keys;
        keys.reserve(num_elements);
        for (int i = 0; i < capacity; ++i) {
            Node* curr = buckets[i];
            while (curr != nullptr) {
                keys.push_back(curr->key);
                curr = curr->next;
            }
        }
        return keys;
    }
};

#endif // HASHMAP_HPP
