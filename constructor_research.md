Geen constructor, Logger/Void extend Logger

```
"constructorArguments": [
    {
      "@id": "clv:Logger/Void/constructorArgumentsObject",
      "extends": "cc:Logger/constructorArgumentsObject"
    }
]
```

Bus extend niks

```
"constructorArguments": [
    {
      "@id": "cc:Bus#constructorArgumentsObject",
      "fields": [
        {
          "keyRaw": "name",
          "value": "rdf:subject"
        }
      ]
    }
]
```
    
```
public readonly name: string;
protected readonly actors: A[] = [];
protected readonly observers: ActionObserver<I, O>[] = [];
protected readonly dependencyLinks: Map<A, A[]> = new Map(); // Mapping from dependency (after) to dependents (before)
constructor(args: IBusArgs) {
    require('lodash.assign')(this, args);
}
```
```
export interface IBusArgs {
  name: string;
}
```

ActionObserver is abstract

```
"parameters": [
{
  "@id": "cc:ActionObserver/bus",
  "comment": "The bus this observer can subscribe to.",
  "range": "cc:Bus",
  "unique": true,
  "required": true
}
],
"constructorArguments": [
    {
      "@id": "cc:ActionObserver/constructorArgumentsObject",
      "fields": [
        {
          "keyRaw": "name",
          "value": "rdf:subject"
        },
        {
          "keyRaw": "bus",
          "value": "cc:ActionObserver/bus"
        }
      ]
    }
]
```


```

public readonly name: string;
public readonly bus: Bus<Actor<I, IActorTest, O>, I, IActorTest, O>;
constructor(args: IActionObserverArgs<I, O>) {
    require('lodash.assign')(this, args);
}
```

```
export interface IActionObserverArgs<I extends IAction, O extends IActorOutput> {
  name: string;
  bus: Bus<Actor<I, IActorTest, O>, I, IActorTest, O>;
}
```


