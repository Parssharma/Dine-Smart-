#ifndef PRIORITYQUEUE_HPP
#define PRIORITYQUEUE_HPP

#include <vector>
#include <stdexcept>
#include <utility>

template <typename T>
class PriorityQueue {
private:
    std::vector<T> heap;

    void heapifyUp(int index) {
        while (index > 0) {
            int parent = (index - 1) / 2;
            if (heap[index] > heap[parent]) { // Max-Heap: child > parent
                std::swap(heap[index], heap[parent]);
                index = parent;
            } else {
                break;
            }
        }
    }

    void heapifyDown(int index) {
        int size = heap.size();
        while (2 * index + 1 < size) {
            int leftChild = 2 * index + 1;
            int rightChild = 2 * index + 2;
            int largest = index;

            if (heap[leftChild] > heap[largest]) {
                largest = leftChild;
            }
            if (rightChild < size && heap[rightChild] > heap[largest]) {
                largest = rightChild;
            }

            if (largest != index) {
                std::swap(heap[index], heap[largest]);
                index = largest;
            } else {
                break;
            }
        }
    }

public:
    PriorityQueue() {}

    bool isEmpty() const {
        return heap.empty();
    }

    int size() const {
        return heap.size();
    }

    void push(const T& element) {
        heap.push_back(element);
        heapifyUp(heap.size() - 1);
    }

    T top() const {
        if (heap.empty()) {
            throw std::underflow_error("PriorityQueue is empty");
        }
        return heap[0];
    }

    void pop() {
        if (heap.empty()) {
            throw std::underflow_error("PriorityQueue is empty");
        }
        heap[0] = heap.back();
        heap.pop_back();
        if (!heap.empty()) {
            heapifyDown(0);
        }
    }

    void clear() {
        heap.clear();
    }
};

#endif // PRIORITYQUEUE_HPP
