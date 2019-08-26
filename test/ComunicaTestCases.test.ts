import {ComunicaTester} from "./ComunicaTester"

const tests = {
    "@comunica/actor-query-operation-filter-sparqlee@1.9.0": {
        "ActorQueryOperationFilterSparqlee": "ActorQueryOperationFilterSparqlee.jsonld"
    },
    "@comunica/actor-init-hello-world@1.9.0": {
        "ActorInitHelloWorld": "ActorInitHelloWorld.jsonld"
    },
    "@comunica/bus-rdf-dereference@1.9.0": {
        "ActorRdfDereference": "ActorRdfDereference.jsonld"
    },
    "@comunica/bus-rdf-dereference-paged@1.9.0": {
        "ActorRdfDereferencePaged": "ActorRdfDereferencePaged.jsonld"
    },
    "@comunica/actor-query-operation-reduced-hash@1.9.0": {
        "ActorQueryOperationReducedHash": "ActorQueryOperationReducedHash.jsonld"
    }
};
ComunicaTester.testModules(tests);
