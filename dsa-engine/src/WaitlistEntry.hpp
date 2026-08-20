#ifndef WAITLISTENTRY_HPP
#define WAITLISTENTRY_HPP

#include <string>

struct WaitlistEntry {
    std::string id;
    std::string customerName;
    int partySize;
    std::string contact;

    WaitlistEntry() : id(""), customerName(""), partySize(0), contact("") {}

    WaitlistEntry(std::string entryId, std::string name, int size, std::string contactInfo)
        : id(entryId), customerName(name), partySize(size), contact(contactInfo) {}
};

#endif // WAITLISTENTRY_HPP
