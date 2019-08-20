const ComunicaTester = require("./ComunicaTester");

const tests = {
    "@comunica/actor-query-operation-filter-sparqlee": {
        "ActorQueryOperationFilterSparqlee": "ActorQueryOperationFilterSparqlee.jsonld"
    },
    "@comunica/actor-init-hello-world": {
        "ActorInitHelloWorld": "ActorInitHelloWorld.jsonld"
    },
    "@comunica/bus-rdf-dereference": {
        "ActorRdfDereference": "ActorRdfDereference.jsonld"
    },
    "@comunica/bus-rdf-dereference-paged": {
        "ActorRdfDereferencePaged": "ActorRdfDereferencePaged.jsonld"
    },
    "@comunica/actor-query-operation-reduced-hash": {
        "ActorQueryOperationReducedHash": "ActorQueryOperationReducedHash.jsonld"
    }
};
ComunicaTester(tests);
