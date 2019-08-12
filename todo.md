* Voeg `.jsonld` file toe aan `import` van de `component.json`
* requireElement invullen, zie bericht op Mattermost	
* Constructorarguments:
    ```
    for arg in constr:
        if 'simple object':
            if name and type match with parsed parameter x:
                voeg {"@id":"bestaande parameter x"} toe
            else:
                voeg {"@id":"nieuwe constructor arg x"} toe
        else:
            // TODO what do we want to do if a another class uses the same constructor argument with an 
            // existing id?
  
            // We have to deal with a class that potentially extends another class
            // We have to deal with a class that potentially has some own fields
            for field in object:
                if name and type match with parameter x:
                    voeg {"value":"bestaande parameter x"} nested toe
                else:
                    // TODO welke value?
                    voeg {"value":"???"} nested toe
                voeg keyRaw toe als naam van veld
            if class extends class y:
                for every component z in scope:
                    for every constructor argument v of z:
                        if constructor argument has id:
                            if constructor argument klasse is y:
                                voeg extends: constructor arg id van y, toe
   ```
