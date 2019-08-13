* Voeg `.jsonld` file toe aan `import` van de `component.json`
* requireElement invullen, zie bericht op Mattermost
* TODO alternative string notations: https://stackoverflow.com/a/14727461/4367621
* Constructorarguments:
    ```
    for arg in constr:
        vind klasse van argument mbhv helper methodes
        if is component:
            if name and type match with parsed parameter x:
                voeg {"@id":"bestaande parameter x"} toe
            else:
                voeg {"@id":"nieuwe constructor arg x"} toe
                // TODO extra velden ook nodig?
        else:
            // TODO what do we want to do if a another class uses the same constructor argument with an 
            // existing id?
  
            // We have to deal with a class that potentially extends another class
            // We have to deal with a class that potentially has some own fields
 
  
            stel 'chain of extends' op
            mapping van klasse -> constructorargumenten
  
        
            zoek in 'chain of extends' naar die klasse als argument
            if gevonden:
                kies uniek ID en gebruik extends voor die klasse
            else:    
                for field in object:
                    voeg keyRaw toe als naam van veld
                if has extending class:
                    zoek @id van extending class in 'chain of extends'
                    if gevonden:
                        zet in extends attribute
                    else
                        error !
          
   ```
