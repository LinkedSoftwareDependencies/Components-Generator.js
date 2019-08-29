import {GeneratorComunicaTester} from "./GeneratorComunicaTester"


/**
 * NPM Comunica test cases to test the generator tool
 * Uses a per-package mapping of exported class name to file to expected result
 */
const tests: { [packageName: string]: { [className: string]: string } } = {

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
    },
    "@comunica/actor-rdf-resolve-hypermedia-sparql@1.9.0": {
        "ActorRdfResolveHypermediaSparql": "ActorRdfResolveHypermediaSparql.jsonld"
    },
    "@comunica/mediator-combine-pipeline@1.9.0": {
        "MediatorCombinePipeline": "MediatorCombinePipeline.jsonld"
    },
    "@comunica/actor-context-preprocess-rdf-source-identifier@1.9.0": {
        "ActorContextPreprocessRdfSourceIdentifier": "ActorContextPreprocessRdfSourceIdentifier.jsonld"
    },
    "@comunica/mediator-race@1.9.0": {
        "MediatorRace": "MediatorRace.jsonld"
    },
    "@comunica/actor-rdf-source-identifier-sparql@1.9.0": {
        "ActorRdfSourceIdentifierSparql": "ActorRdfSourceIdentifierSparql.jsonld"
    }
};
GeneratorComunicaTester.testPackages(tests);
