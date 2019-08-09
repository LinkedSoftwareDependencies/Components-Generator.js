* Voeg `.jsonld` file toe aan `import` van de `component.json`
* requireElement invullen, zie bericht op Mattermost	
* Constructorarguments:
    ```
    for arg in constr:
        if 'simple object':
            if name and type match with parameter x:
                voeg {"@id":"bestaande parameter x"} toe
            else:
                voeg {"@id":"nieuwe constructor arg x"} toe
        else:
            // We have to deal with a class that potentially extends another class
            // We have to deal with a class that potentially has some own fields
            for field in object:
                if name and type match with parameter x:
                    voeg {"@id":"bestaande parameter x"} nested toe
                else:
                    voeg {"@id":"nieuwe constructor arg x"} nested toe
            if class extends class y:
                // TODO what to do if we can't find an id for y?
                if class y heeft id:
                    voeg extends y attribute toe
   ```
