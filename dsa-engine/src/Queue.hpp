#ifndef QUEUE_HPP
#define QUEUE_HPP

#include <stdexcept>
#include <vector>

template <typename T>
class Queue {
private:
    struct Node {
        T data;
        Node* next;
        Node(const T& val) : data(val), next(nullptr) {}
    };

    Node* head;
    Node* tail;
    int num_elements;

public:
    Queue() : head(nullptr), tail(nullptr), num_elements(0) {}

    ~Queue() {
        clear();
    }

    void clear() {
        Node* curr = head;
        while (curr != nullptr) {
            Node* temp = curr;
            curr = curr->next;
            delete temp;
        }
        head = nullptr;
        tail = nullptr;
        num_elements = 0;
    }

    bool isEmpty() const {
        return num_elements == 0;
    }

    int size() const {
        return num_elements;
    }

    void enqueue(const T& value) {
        Node* new_node = new Node(value);
        if (tail == nullptr) {
            head = tail = new_node;
        } else {
            tail->next = new_node;
            tail = new_node;
        }
        num_elements++;
    }

    T dequeue() {
        if (isEmpty()) {
            throw std::underflow_error("Queue is empty");
        }
        Node* temp = head;
        T val = temp->data;
        head = head->next;
        if (head == nullptr) {
            tail = nullptr;
        }
        delete temp;
        num_elements--;
        return val;
    }

    T& front() {
        if (isEmpty()) {
            throw std::runtime_error("Queue is empty");
        }
        return head->data;
    }

    const T& front() const {
        if (isEmpty()) {
            throw std::runtime_error("Queue is empty");
        }
        return head->data;
    }

    std::vector<T> toVector() const {
        std::vector<T> vec;
        vec.reserve(num_elements);
        Node* curr = head;
        while (curr != nullptr) {
            vec.push_back(curr->data);
            curr = curr->next;
        }
        return vec;
    }
};

#endif // QUEUE_HPP
